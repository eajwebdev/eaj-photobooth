import { getStation } from '@/lib/station';
import { createStore, del, entries, set, type UseStore } from 'idb-keyval';

/**
 * The never-lose upload queue.
 *
 * Every capture (and every new guest album) is written to IndexedDB first and
 * only then sent. Items retry with exponential backoff (2 s → 60 s), whenever
 * the device comes back online, and when the app starts. An item is deleted
 * only after the server answers 2xx; a 4xx (other than 408/429) parks it as
 * failed with the server's message so staff can see it.
 */

export type QueueState = 'pending' | 'uploading' | 'failed';

export interface QueuedFile {
    field: string;
    name: string;
    blob: Blob;
}

interface BaseItem {
    /** The client_uuid; uploads are idempotent on it, so a repeat is harmless. */
    id: string;
    createdAt: number;
    attempts: number;
    nextAttemptAt: number;
    state: QueueState;
    error?: string;
    station: string | null;
}

export interface AlbumItem extends BaseItem {
    kind: 'album';
    guestName: string | null;
}

export interface CaptureItem extends BaseItem {
    kind: 'capture';
    type: 'collage' | 'boomerang';
    albumClientUuid: string | null;
    fields: Record<string, string>;
    files: QueuedFile[];
}

export type QueueItem = AlbumItem | CaptureItem;

export interface QueueSnapshot {
    items: Omit<QueueItem, 'files'>[];
    waiting: number;
    failed: number;
    /** Upload progress 0–1 for items being sent right now. */
    progress: Record<string, number>;
}

export interface UploadResult {
    item: QueueItem;
    /** The server's JSON `data` (CaptureResource or AlbumResource). */
    data: Record<string, unknown>;
}

const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 60_000;
const TICK_MS = 4000;
const HEARTBEAT_MS = 30_000;

let store: UseStore | null = null;
let items = new Map<string, QueueItem>();
const progress: Record<string, number> = {};
const listeners = new Set<(snapshot: QueueSnapshot) => void>();
const uploadedListeners = new Set<(result: UploadResult) => void>();
let loaded: Promise<void> | null = null;
let running = false;
let started = false;

function queueStore(): UseStore {
    store ??= createStore('je-uploads', 'queue');

    return store;
}

export function backoffDelay(attempts: number): number {
    return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

/** 4xx means the server will never accept it as is, except timeouts and rate limits. */
export function isPermanentFailure(status: number): boolean {
    return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function snapshot(): QueueSnapshot {
    const list = [...items.values()].sort((a, b) => a.createdAt - b.createdAt);

    return {
        items: list.map((item) => {
            if (item.kind === 'capture') {
                const { files: _files, ...rest } = item;
                void _files;

                return rest;
            }

            return item;
        }),
        waiting: list.filter((item) => item.state !== 'failed').length,
        failed: list.filter((item) => item.state === 'failed').length,
        progress: { ...progress },
    };
}

function emit(): void {
    const current = snapshot();
    listeners.forEach((listener) => listener(current));
}

async function persist(item: QueueItem): Promise<void> {
    items.set(item.id, item);
    await set(item.id, item, queueStore());
    emit();
}

function load(): Promise<void> {
    loaded ??= entries<string, QueueItem>(queueStore())
        .then((rows) => {
            items = new Map(rows.map(([key, item]) => [key, { ...item, state: item.state === 'uploading' ? 'pending' : item.state }]));
            emit();
        })
        .catch(() => {
            // IndexedDB unavailable (private mode): the queue lives in memory only.
        });

    return loaded;
}

function send(item: QueueItem): Promise<{ status: number; body: Record<string, unknown> | null }> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const form = new FormData();
        let url: string;

        if (item.kind === 'album') {
            url = '/api/albums';
            form.append('client_uuid', item.id);

            if (item.guestName) {
                form.append('guest_name', item.guestName);
            }
        } else {
            url = '/api/captures';
            Object.entries(item.fields).forEach(([key, value]) => form.append(key, value));
            item.files.forEach((file) => form.append(file.field, file.blob, file.name));
        }

        if (item.station) {
            form.append('station', item.station);
        }

        xhr.open('POST', url);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.timeout = 120_000;
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                progress[item.id] = event.loaded / event.total;
                emit();
            }
        };
        xhr.onload = () => {
            let body: Record<string, unknown> | null = null;

            try {
                body = JSON.parse(xhr.responseText) as Record<string, unknown>;
            } catch {
                body = null;
            }

            resolve({ status: xhr.status, body });
        };
        xhr.onerror = () => resolve({ status: 0, body: null });
        xhr.ontimeout = () => resolve({ status: 0, body: null });
        xhr.send(form);
    });
}

async function attempt(item: QueueItem): Promise<void> {
    await persist({ ...item, state: 'uploading' });
    const { status, body } = await send(item);
    delete progress[item.id];

    if (status >= 200 && status < 300) {
        items.delete(item.id);
        await del(item.id, queueStore()).catch(() => undefined);
        emit();

        const data = (body?.data ?? {}) as Record<string, unknown>;
        uploadedListeners.forEach((listener) => listener({ item, data }));

        return;
    }

    const attempts = item.attempts + 1;

    if (isPermanentFailure(status)) {
        const message = typeof body?.message === 'string' ? body.message : `The server refused this upload (${status}).`;
        await persist({ ...item, attempts, state: 'failed', error: message });

        return;
    }

    await persist({ ...item, attempts, state: 'pending', nextAttemptAt: Date.now() + backoffDelay(attempts), error: undefined });
}

/** Sends every item that is due, oldest first (albums before their captures). One at a time. */
export async function processQueue(force = false): Promise<void> {
    await load();

    if (running) {
        return;
    }

    running = true;

    try {
        for (;;) {
            const now = Date.now();
            const next = [...items.values()]
                .filter((item) => item.state === 'pending' && (force || item.nextAttemptAt <= now))
                .sort((a, b) => (a.kind === b.kind ? a.createdAt - b.createdAt : a.kind === 'album' ? -1 : 1))[0];

            if (!next || (typeof navigator !== 'undefined' && navigator.onLine === false && !force)) {
                break;
            }

            await attempt(next);
        }
    } finally {
        running = false;
    }
}

/** Saves to the device first, then tries to upload straight away. */
export async function enqueue(
    item:
        | Omit<AlbumItem, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'state'>
        | Omit<CaptureItem, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'state'>,
): Promise<void> {
    await load();
    await persist({ ...item, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0, state: 'pending' } as QueueItem);
    void processQueue();
}

/** Puts failed items back in line (staff action). */
export async function retryFailed(): Promise<void> {
    await load();

    for (const item of items.values()) {
        if (item.state === 'failed') {
            await persist({ ...item, state: 'pending', nextAttemptAt: 0, error: undefined });
        }
    }

    await processQueue(true);
}

export function subscribe(listener: (snapshot: QueueSnapshot) => void): () => void {
    listeners.add(listener);
    listener(snapshot());

    return () => listeners.delete(listener);
}

export function onUploaded(listener: (result: UploadResult) => void): () => void {
    uploadedListeners.add(listener);

    return () => uploadedListeners.delete(listener);
}

/** Starts the background worker once per page load: on start, on 'online', and on a slow tick. */
export function startUploadQueue(): void {
    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;
    void load().then(() => processQueue());
    window.addEventListener('online', () => void processQueue(true));
    window.setInterval(() => void processQueue(), TICK_MS);
    window.setInterval(() => void sendHeartbeat(), HEARTBEAT_MS);
}

/**
 * Booth devices (those given a station name) tell the control room how many
 * uploads they are still holding, so staff can spot a booth that lost Wi-Fi.
 */
async function sendHeartbeat(): Promise<void> {
    const station = getStation();

    if (!station) {
        return;
    }

    const { waiting, failed } = snapshot();

    try {
        await fetch('/api/stations/heartbeat', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ station, waiting, failed }),
        });
    } catch {
        // Offline: the next heartbeat will tell the story.
    }
}
