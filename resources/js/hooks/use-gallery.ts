import type { CaptureData } from '@/lib/captures';
import { fetchAlbum, fetchGallery, GalleryError, type GalleryFilter } from '@/lib/gallery-api';
import { myAlbums } from '@/lib/my-albums';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const POLL_MS = 10_000;
const AT_TOP_PX = 160;

export interface GalleryState {
    items: CaptureData[];
    /** Newer photos held back while the guest is scrolled down. */
    pending: CaptureData[];
    total: number;
    status: 'loading' | 'ready' | 'error';
    error: GalleryError | null;
    hasMore: boolean;
    loadingMore: boolean;
    loadMore: () => void;
    showPending: () => void;
    retry: () => void;
}

function typeFor(filter: GalleryFilter): 'collage' | 'boomerang' | undefined {
    return filter === 'collage' || filter === 'boomerang' ? filter : undefined;
}

/** Albums this phone has opened, merged newest first. */
async function loadMine(query: string): Promise<CaptureData[]> {
    const albums = await Promise.all(myAlbums().map((album) => fetchAlbum(album.code).catch(() => null)));
    const term = query.trim().toLowerCase();
    const seen = new Set<string>();

    return albums
        .flatMap((album) => album?.captures.map((capture) => ({ ...capture, album: capture.album ?? album.code })) ?? [])
        .filter((capture) => (seen.has(capture.uuid) ? false : (seen.add(capture.uuid), true)))
        .filter((capture) => !term || (capture.guest_name ?? '').toLowerCase().includes(term))
        .sort((a, b) => b.id - a.id);
}

/**
 * The gallery's data: first page, infinite scroll (cursor pagination) and new
 * captures every 10 s. New photos never push the grid while the guest is
 * scrolled down; they wait behind a "new photos" pill instead.
 */
export interface GalleryScope {
    group?: string | null;
    challenge?: number | null;
}

export function useGallery(filter: GalleryFilter, query: string, scope: GalleryScope = {}): GalleryState {
    const { group = null, challenge = null } = scope;
    const extra = useMemo(
        () => ({ sort: filter === 'loved' ? ('loved' as const) : undefined, group, challenge: filter === 'challenges' ? challenge : null }),
        [challenge, filter, group],
    );
    const [items, setItems] = useState<CaptureData[]>([]);
    const [pending, setPending] = useState<CaptureData[]>([]);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState<GalleryState['status']>('loading');
    const [error, setError] = useState<GalleryError | null>(null);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const request = useRef(0);
    const newest = useRef(0);

    useEffect(() => {
        const id = ++request.current;
        setStatus('loading');
        setError(null);
        setPending([]);

        const load = async () => {
            if (filter === 'mine') {
                const mine = await loadMine(query);

                return { data: mine, nextCursor: null, total: mine.length };
            }

            // The challenges tab lists challenges until one is chosen.
            if (filter === 'challenges' && !challenge) {
                return { data: [], nextCursor: null, total: 0 };
            }

            return fetchGallery({ type: typeFor(filter), q: query, ...extra });
        };

        load()
            .then((page) => {
                if (id !== request.current) {
                    return;
                }

                setItems(page.data);
                setCursor(page.nextCursor);
                setTotal(page.total);
                newest.current = page.data[0]?.id ?? 0;
                setStatus('ready');
            })
            .catch((caught: unknown) => {
                if (id !== request.current) {
                    return;
                }

                setError(caught instanceof GalleryError ? caught : new GalleryError('server', 'The photos could not be loaded.'));
                setStatus('error');
            });
    }, [challenge, extra, filter, query, reloadKey]);

    const loadMore = useCallback(() => {
        if (!cursor || loadingMore || status !== 'ready') {
            return;
        }

        const id = request.current;
        setLoadingMore(true);

        fetchGallery({ type: typeFor(filter), q: query, cursor, ...extra })
            .then((page) => {
                if (id !== request.current) {
                    return;
                }

                setItems((current) => {
                    const known = new Set(current.map((item) => item.uuid));

                    return [...current, ...page.data.filter((item) => !known.has(item.uuid))];
                });
                setCursor(page.nextCursor);
                setTotal(page.total);
            })
            .catch(() => undefined)
            .finally(() => setLoadingMore(false));
    }, [cursor, extra, filter, loadingMore, query, status]);

    // Live updates: what arrived since the newest photo on screen.
    useEffect(() => {
        // New arrivals only make sense in newest-first views.
        if (status !== 'ready' || filter === 'mine' || filter === 'loved' || (filter === 'challenges' && !challenge)) {
            return;
        }

        const timer = window.setInterval(() => {
            const id = request.current;

            fetchGallery({ type: typeFor(filter), q: query, after: newest.current, ...extra })
                .then((page) => {
                    if (id !== request.current) {
                        return;
                    }

                    setTotal(page.total);

                    if (page.data.length === 0) {
                        return;
                    }

                    newest.current = page.data[0].id;

                    if (window.scrollY < AT_TOP_PX) {
                        setItems((current) => [...page.data, ...current]);
                    } else {
                        setPending((current) => [...page.data, ...current]);
                    }
                })
                .catch(() => undefined);
        }, POLL_MS);

        return () => window.clearInterval(timer);
    }, [challenge, extra, filter, query, status]);

    const showPending = useCallback(() => {
        setItems((current) => [...pending, ...current]);
        setPending([]);
    }, [pending]);

    const retry = useCallback(() => setReloadKey((key) => key + 1), []);

    return { items, pending, total, status, error, hasMore: cursor !== null, loadingMore, loadMore, showPending, retry };
}
