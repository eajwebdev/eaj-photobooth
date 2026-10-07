import { enqueue, onUploaded } from '@/lib/upload-queue';
import { uuid } from '@/lib/uuid';
import { del, get, set } from 'idb-keyval';

const ALBUM_KEY = 'je.album';

/**
 * The guest group's album at this booth. Created on the device (so it works
 * offline); the readable code such as "ROSE-4821" arrives with the first
 * successful sync and is shown the moment it is known.
 */
export interface AlbumSession {
    clientUuid: string;
    code: string | null;
    url: string | null;
    openedAt: number;
}

let current: AlbumSession | null = null;
let loaded: Promise<AlbumSession | null> | null = null;
const listeners = new Set<(album: AlbumSession | null) => void>();

function emit(): void {
    listeners.forEach((listener) => listener(current));
}

async function store(album: AlbumSession | null): Promise<void> {
    current = album;
    emit();

    try {
        if (album) {
            await set(ALBUM_KEY, album);
        } else {
            await del(ALBUM_KEY);
        }
    } catch {
        // Kept in memory only.
    }
}

export function loadAlbum(): Promise<AlbumSession | null> {
    loaded ??= get<AlbumSession>(ALBUM_KEY)
        .then((saved) => {
            current = saved ?? null;
            emit();

            return current;
        })
        .catch(() => null);

    return loaded;
}

/** The open album, or a new one registered in the background. */
export async function ensureAlbum(station: string | null): Promise<AlbumSession> {
    const existing = await loadAlbum();

    if (existing) {
        return existing;
    }

    const album: AlbumSession = { clientUuid: uuid(), code: null, url: null, openedAt: Date.now() };
    await store(album);
    await enqueue({ kind: 'album', id: album.clientUuid, guestName: null, station });

    return album;
}

/** "I'm done": the next group gets a fresh album. */
export async function closeAlbum(): Promise<void> {
    await loadAlbum();
    await store(null);
}

export function subscribeAlbum(listener: (album: AlbumSession | null) => void): () => void {
    listeners.add(listener);
    listener(current);

    return () => listeners.delete(listener);
}

export function albumUrl(shareUrl: string, code: string): string {
    return `${shareUrl.replace(/\/+$/, '')}/a/${code}`;
}

// The code arrives with the album item, or with any capture filed into the album.
onUploaded(({ item, data }) => {
    if (!current) {
        return;
    }

    const isThisAlbum = item.kind === 'album' ? item.id === current.clientUuid : item.albumClientUuid === current.clientUuid;
    const code = item.kind === 'album' ? data.code : data.album;

    if (isThisAlbum && typeof code === 'string' && code !== current.code) {
        void store({ ...current, code, url: typeof data.url === 'string' ? data.url : current.url });
    }
});
