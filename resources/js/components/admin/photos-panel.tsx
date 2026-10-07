import { GhostButton } from '@/components/chapel/gold-button';
import { ApiError } from '@/lib/api';
import type { CaptureData } from '@/lib/captures';
import { pinFetch } from '@/lib/pin-api';
import { cn } from '@/lib/utils';
import { Crown, Eye, EyeOff, Repeat, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface AdminCapture extends CaptureData {
    station?: string | null;
    created_at: string;
    is_hidden?: boolean;
}

interface ListResponse {
    data: AdminCapture[];
    meta: { current_page: number; last_page: number; total: number };
    stations: string[];
}

interface Filters {
    type: '' | 'collage' | 'boomerang';
    hidden: '' | '0' | '1';
    station: string;
    album: string;
    q: string;
}

const NO_FILTERS: Filters = { type: '', hidden: '', station: '', album: '', q: '' };

const selectClass = 'border-gold-light/30 bg-navy text-mist focus:border-gold h-11 rounded-full border px-4 text-sm focus:outline-none';

/** Every capture for staff: filter, hide or show instantly, mark favourites, delete. */
export function PhotosPanel({ onLocked }: { onLocked: () => void }) {
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<ListResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const load = useCallback(() => {
        const params = new URLSearchParams({ page: String(page) });
        Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));

        pinFetch<ListResponse>('admin', `/captures?${params.toString()}`)
            .then((data) => {
                setResult(data);
                setError(null);
            })
            .catch((caught: ApiError) => (caught.status === 401 ? onLocked() : setError(caught.message)));
    }, [filters, onLocked, page]);

    useEffect(() => {
        const timer = window.setTimeout(load, 250);

        return () => window.clearTimeout(timer);
    }, [load]);

    const update = async (capture: AdminCapture, patch: { is_hidden?: boolean; is_couple_favourite?: boolean }) => {
        // Show the change at once; the server confirms it.
        setResult(
            (current) => current && { ...current, data: current.data.map((item) => (item.uuid === capture.uuid ? { ...item, ...patch } : item)) },
        );

        try {
            await pinFetch('admin', `/captures/${capture.uuid}`, { method: 'PATCH', body: JSON.stringify(patch) });
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'That change was not saved.');
            load();
        }
    };

    const remove = async (capture: AdminCapture) => {
        setConfirmDelete(null);

        try {
            await pinFetch('admin', `/captures/${capture.uuid}`, { method: 'DELETE' });
            load();
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'It could not be deleted.');
        }
    };

    const setFilter = (patch: Partial<Filters>) => {
        setFilters((current) => ({ ...current, ...patch }));
        setPage(1);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
                <select
                    aria-label="Type"
                    className={selectClass}
                    value={filters.type}
                    onChange={(event) => setFilter({ type: event.target.value as Filters['type'] })}
                >
                    <option value="">Collages and boomerangs</option>
                    <option value="collage">Collages</option>
                    <option value="boomerang">Boomerangs</option>
                </select>
                <select
                    aria-label="Visibility"
                    className={selectClass}
                    value={filters.hidden}
                    onChange={(event) => setFilter({ hidden: event.target.value as Filters['hidden'] })}
                >
                    <option value="">Shown and hidden</option>
                    <option value="0">Shown in the gallery</option>
                    <option value="1">Hidden</option>
                </select>
                <select
                    aria-label="Booth"
                    className={selectClass}
                    value={filters.station}
                    onChange={(event) => setFilter({ station: event.target.value })}
                >
                    <option value="">All booths</option>
                    {result?.stations.map((station) => (
                        <option key={station} value={station}>
                            {station}
                        </option>
                    ))}
                </select>
                <input
                    aria-label="Album code"
                    placeholder="Album code"
                    value={filters.album}
                    onChange={(event) => setFilter({ album: event.target.value })}
                    className={cn(selectClass, 'w-36 uppercase placeholder:normal-case')}
                />
                <input
                    aria-label="Guest name"
                    placeholder="Guest name"
                    value={filters.q}
                    onChange={(event) => setFilter({ q: event.target.value })}
                    className={cn(selectClass, 'w-44')}
                />
            </div>

            {error && (
                <p role="alert" className="text-sm text-[#f0b3aa]">
                    {error}
                </p>
            )}

            <p className="text-mist/65 text-sm">{result ? `${result.meta.total.toLocaleString()} found` : 'Loading…'}</p>

            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {result?.data.map((capture) => (
                    <li key={capture.uuid} className={cn('flex flex-col gap-2', capture.is_hidden && 'opacity-55')}>
                        <a
                            href={capture.urls.page}
                            target="_blank"
                            rel="noreferrer"
                            className="relative block overflow-hidden rounded-[3px]"
                            style={{
                                aspectRatio: `${capture.width ?? 2} / ${capture.height ?? 3}`,
                                backgroundColor: capture.dominant_color ?? '#132A63',
                            }}
                        >
                            <img src={capture.urls.thumb} alt="" loading="lazy" className="size-full object-cover" />
                            {capture.type === 'boomerang' && <Repeat className="text-gold-light absolute top-2 left-2 size-5" />}
                            {capture.is_couple_favourite && <Crown className="text-gold absolute top-2 right-2 size-5" />}
                        </a>
                        <div className="text-mist/75 text-xs leading-snug">
                            <p className="text-mist truncate">{capture.guest_name ?? 'No name'}</p>
                            <p className="truncate">
                                {capture.station ?? 'Unknown booth'}
                                {capture.album ? `, ${capture.album}` : ''}
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => void update(capture, { is_hidden: !capture.is_hidden })}
                                className="border-gold-light/30 text-mist hover:border-gold-light/60 inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border text-xs"
                            >
                                {capture.is_hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                                {capture.is_hidden ? 'Show' : 'Hide'}
                            </button>
                            <button
                                type="button"
                                aria-label={capture.is_couple_favourite ? "Remove from the couple's favourites" : "Mark as the couple's favourite"}
                                aria-pressed={capture.is_couple_favourite}
                                onClick={() => void update(capture, { is_couple_favourite: !capture.is_couple_favourite })}
                                className={cn(
                                    'inline-flex size-10 items-center justify-center rounded-full border',
                                    capture.is_couple_favourite ? 'border-gold bg-gold/20 text-gold-light' : 'border-gold-light/30 text-mist/70',
                                )}
                            >
                                <Crown className="size-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="Delete"
                                onClick={() => setConfirmDelete(capture.uuid)}
                                className="border-gold-light/30 text-mist/70 inline-flex size-10 items-center justify-center rounded-full border hover:text-[#f0b3aa]"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        </div>
                        {confirmDelete === capture.uuid && (
                            <div
                                role="alertdialog"
                                aria-label="Delete this capture?"
                                className="bg-navy-2 flex flex-col gap-2 rounded-xl p-3 text-xs"
                            >
                                <p className="text-mist">Delete it for good? This removes the files too. Hiding keeps a copy.</p>
                                <div className="flex gap-2">
                                    <button type="button" className="text-mist/80 min-h-10 flex-1 underline" onClick={() => setConfirmDelete(null)}>
                                        Keep
                                    </button>
                                    <button
                                        type="button"
                                        className="min-h-10 flex-1 rounded-full bg-[#b9473b] text-white"
                                        onClick={() => void remove(capture)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {result && result.meta.last_page > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <GhostButton type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Newer
                    </GhostButton>
                    <span className="text-mist/70 text-sm">
                        Page {result.meta.current_page} of {result.meta.last_page}
                    </span>
                    <GhostButton type="button" disabled={page >= result.meta.last_page} onClick={() => setPage(page + 1)}>
                        Older
                    </GhostButton>
                </div>
            )}
        </div>
    );
}
