import type { CaptureData } from '@/lib/captures';

const CODE_KEY = 'je.galleryCode';

export type GalleryFilter = 'all' | 'collage' | 'boomerang' | 'loved' | 'challenges' | 'mine';

export interface GalleryPage {
    data: CaptureData[];
    nextCursor: string | null;
    total: number;
}

export interface AlbumData {
    code: string;
    url: string;
    guest_name: string | null;
    captures_count: number;
    zip_url: string;
    captures: CaptureData[];
    challenges?: { done: number; total: number };
}

export type GalleryErrorKind = 'code' | 'offline' | 'server';

export class GalleryError extends Error {
    constructor(
        public readonly kind: GalleryErrorKind,
        message: string,
    ) {
        super(message);
    }
}

export function savedGalleryCode(): string | null {
    try {
        return window.localStorage.getItem(CODE_KEY);
    } catch {
        return null;
    }
}

/** The wedding code is remembered on the phone, so it is asked for only once. */
export function rememberGalleryCode(code: string): void {
    try {
        window.localStorage.setItem(CODE_KEY, code.trim());
    } catch {
        // Asked again next visit.
    }
}

async function getJson(path: string): Promise<Record<string, unknown>> {
    const code = savedGalleryCode();
    let response: Response;

    try {
        response = await fetch(path, { headers: { Accept: 'application/json', ...(code ? { 'X-Gallery-Code': code } : {}) } });
    } catch {
        throw new GalleryError('offline', 'You seem to be offline.');
    }

    if (response.status === 401) {
        throw new GalleryError('code', 'Enter the wedding code to see the photos.');
    }

    if (!response.ok) {
        throw new GalleryError('server', 'The photos could not be loaded.');
    }

    return (await response.json()) as Record<string, unknown>;
}

export interface GalleryQuery {
    type?: 'collage' | 'boomerang';
    q?: string;
    cursor?: string | null;
    after?: number;
    perPage?: number;
    sort?: 'newest' | 'loved';
    group?: string | null;
    challenge?: number | null;
}

export async function fetchGallery(query: GalleryQuery): Promise<GalleryPage> {
    const params = new URLSearchParams();

    if (query.type) {
        params.set('type', query.type);
    }

    if (query.q?.trim()) {
        params.set('q', query.q.trim());
    }

    if (query.cursor) {
        params.set('cursor', query.cursor);
    }

    if (query.after !== undefined) {
        params.set('after', String(query.after));
    }

    if (query.sort === 'loved') {
        params.set('sort', 'loved');
    }

    if (query.group) {
        params.set('group', query.group);
    }

    if (query.challenge) {
        params.set('challenge', String(query.challenge));
    }

    params.set('per_page', String(query.perPage ?? 30));

    const body = await getJson(`/api/gallery?${params.toString()}`);
    const meta = body.meta as { next_cursor?: string | null } | undefined;

    return {
        data: (body.data as CaptureData[]) ?? [],
        nextCursor: meta?.next_cursor ?? null,
        total: typeof body.total === 'number' ? body.total : 0,
    };
}

export async function fetchAlbum(code: string): Promise<AlbumData | null> {
    try {
        return (await getJson(`/api/albums/${encodeURIComponent(code)}`)).data as AlbumData;
    } catch (error) {
        if (error instanceof GalleryError && error.kind === 'server') {
            return null;
        }

        throw error;
    }
}
