import { GhostButton } from '@/components/chapel/gold-button';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import { pinFetch } from '@/lib/pin-api';
import { getStation } from '@/lib/station';
import { retryFailed } from '@/lib/upload-queue';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface StationRow {
    station: string;
    total: number;
    last_capture_at: string | null;
    waiting?: number;
    failed?: number;
    last_seen?: string;
}

interface Stats {
    captures: { total: number; collage: number; boomerang: number; today: number; hidden: number; with_wish: number };
    albums: number;
    downloads: number;
    pending_derivatives: number;
    drive_backup: { enabled: boolean; complete: number; pending: number; failed: number; not_queued: number };
    stations: StationRow[];
}

const REFRESH_MS = 10_000;
const STALE_MS = 2 * 60_000;

function ago(iso: string | null | undefined): string {
    if (!iso) {
        return 'never';
    }

    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));

    if (seconds < 60) {
        return 'just now';
    }

    const minutes = Math.round(seconds / 60);

    return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

/** Live numbers for staff, and how each booth's uploads are doing. */
export function OverviewPanel({ onLocked }: { onLocked: () => void }) {
    const [stats, setStats] = useState<Stats | null>(null);
    const queue = useUploadQueue();
    const thisStation = getStation();

    useEffect(() => {
        let alive = true;

        const load = () =>
            pinFetch<{ data: Stats }>('admin', '/stats')
                .then(({ data }) => alive && setStats(data))
                .catch((error: { status?: number }) => error.status === 401 && onLocked());

        void load();
        const timer = window.setInterval(load, REFRESH_MS);

        return () => {
            alive = false;
            window.clearInterval(timer);
        };
    }, [onLocked]);

    const figures: [string, number | undefined][] = [
        ['photos and boomerangs', stats?.captures.total],
        ['collages', stats?.captures.collage],
        ['boomerangs', stats?.captures.boomerang],
        ['today', stats?.captures.today],
        ['guest albums', stats?.albums],
        ['downloads', stats?.downloads],
        ['wishes', stats?.captures.with_wish],
        ['hidden', stats?.captures.hidden],
    ];

    return (
        <div className="flex flex-col gap-10">
            <dl className="border-gold-light/20 grid grid-cols-2 border-t sm:grid-cols-4">
                {figures.map(([label, value]) => (
                    <div
                        key={label}
                        className="border-gold-light/20 flex flex-col gap-1 border-b px-2 py-5 text-center sm:[&:not(:nth-child(4n))]:border-r"
                    >
                        <dt className="text-mist/65 order-2 text-sm">{label}</dt>
                        <dd className="font-display text-mist order-1 text-4xl">{value === undefined ? '…' : value.toLocaleString()}</dd>
                    </div>
                ))}
            </dl>

            {stats && stats.pending_derivatives > 0 && (
                <p className="text-mist/70 text-sm">
                    {stats.pending_derivatives} photos are still being prepared for the gallery. If this number does not go down, check that the queue
                    worker is running.
                </p>
            )}

            {stats?.drive_backup.enabled && (
                <section className="border-gold-light/20 flex flex-col gap-2 rounded-2xl border p-5">
                    <h2 className="font-display text-gold-light text-xl italic">Google Drive backup</h2>
                    <p className="text-mist/80 text-sm">
                        {stats.drive_backup.complete.toLocaleString()} backed up, {stats.drive_backup.pending.toLocaleString()} waiting
                        {stats.drive_backup.failed > 0 ? `, ${stats.drive_backup.failed.toLocaleString()} failed` : ''}
                        {stats.drive_backup.not_queued > 0 ? `, ${stats.drive_backup.not_queued.toLocaleString()} not queued` : ''}.
                    </p>
                    {(stats.drive_backup.pending > 0 || stats.drive_backup.failed > 0) && (
                        <p className="text-mist/60 text-xs">The separate backups queue worker must be running.</p>
                    )}
                </section>
            )}

            <section className="flex flex-col gap-4">
                <h2 className="font-display text-gold-light text-2xl italic">Booths</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-sm">
                        <thead className="text-mist/60">
                            <tr className="border-gold-light/20 border-b">
                                <th className="py-2 font-normal">Booth</th>
                                <th className="py-2 font-normal">Photos</th>
                                <th className="py-2 font-normal">Waiting to upload</th>
                                <th className="py-2 font-normal">Last check-in</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(stats?.stations ?? []).map((row) => {
                                const stale = row.last_seen ? Date.now() - new Date(row.last_seen).getTime() > STALE_MS : false;

                                return (
                                    <tr key={row.station} className="border-gold-light/10 border-b">
                                        <td className="text-mist py-3">{row.station}</td>
                                        <td className="text-mist py-3">{row.total}</td>
                                        <td
                                            className={cn(
                                                'py-3',
                                                (row.waiting ?? 0) > 0 || (row.failed ?? 0) > 0 ? 'text-gold-light' : 'text-mist/70',
                                            )}
                                        >
                                            {row.waiting === undefined
                                                ? 'not reported'
                                                : `${row.waiting} waiting${row.failed ? `, ${row.failed} could not upload` : ''}`}
                                        </td>
                                        <td className={cn('py-3', stale ? 'text-[#f0b3aa]' : 'text-mist/70')}>
                                            {ago(row.last_seen ?? row.last_capture_at)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="border-gold-light/20 flex flex-col gap-3 rounded-2xl border p-5">
                <h2 className="font-display text-gold-light text-xl italic">This device{thisStation ? `: ${thisStation}` : ''}</h2>
                <p className="text-mist/80 text-sm">
                    {queue.waiting === 0 && queue.failed === 0
                        ? 'Everything taken on this device has been uploaded.'
                        : `${queue.waiting} waiting to upload${queue.failed ? `, ${queue.failed} could not upload` : ''}.`}
                </p>
                {queue.items
                    .filter((item) => item.state === 'failed')
                    .map((item) => (
                        <p key={item.id} className="text-sm text-[#f0b3aa]">
                            {item.kind === 'album' ? 'Album' : 'Capture'}: {item.error}
                        </p>
                    ))}
                {(queue.waiting > 0 || queue.failed > 0) && (
                    <GhostButton type="button" className="self-start" onClick={() => void retryFailed()}>
                        Try uploading now
                    </GhostButton>
                )}
            </section>
        </div>
    );
}
