import { GhostButton } from '@/components/chapel/gold-button';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import type { ApiError } from '@/lib/api';
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

interface DriveError {
    capture_id: number;
    guest_name: string | null;
    status: 'pending' | 'processing' | 'complete' | 'failed' | null;
    error: string;
    at: string | null;
}

interface DriveBackup {
    enabled: boolean;
    configured: boolean;
    complete: number;
    pending: number;
    failed: number;
    not_queued: number;
    stuck: number;
    errors: DriveError[];
}

interface Stats {
    captures: { total: number; collage: number; boomerang: number; today: number; hidden: number; with_wish: number };
    albums: number;
    downloads: number;
    pending_derivatives: number;
    drive_backup: DriveBackup;
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

type DriveAction = { state: 'idle' } | { state: 'busy' } | { state: 'done'; ok: boolean; message: string };

/** Backup totals, why recent backups did not reach Drive, and buttons to test and retry. */
function DriveBackupSection({ backup, onLocked }: { backup: DriveBackup; onLocked: () => void }) {
    const [action, setAction] = useState<DriveAction>({ state: 'idle' });

    const run = (path: string, describe: (data: { ok?: boolean; message?: string | null; queued?: number }) => [boolean, string]) => {
        setAction({ state: 'busy' });

        pinFetch<{ data: { ok?: boolean; message?: string | null; queued?: number } }>('admin', path, { method: 'POST' })
            .then(({ data }) => {
                const [ok, message] = describe(data);
                setAction({ state: 'done', ok, message });
            })
            .catch((error: ApiError) => {
                if (error.status === 401) {
                    onLocked();
                }

                setAction({ state: 'done', ok: false, message: error.message });
            });
    };

    const testConnection = () =>
        run('/drive/check', (data) => [
            data.ok === true,
            data.ok ? 'Connected. The backup folder accepts new files.' : (data.message ?? 'Not connected.'),
        ]);

    const retryFailed = () =>
        run('/drive/retry', (data) => [true, `${data.queued ?? 0} backups queued again. They upload the next time the backups worker runs.`]);

    return (
        <section className="border-gold-light/20 flex flex-col gap-3 rounded-2xl border p-5">
            <h2 className="font-display text-gold-light text-xl italic">Google Drive backup</h2>

            {!backup.configured && (
                <p className="text-sm text-[#f0b3aa]">
                    Backups are switched on, but some Google Drive settings are missing in .env. Nothing will reach Drive until they are filled in.
                </p>
            )}

            <p className="text-mist/80 text-sm">
                {backup.complete.toLocaleString()} backed up, {backup.pending.toLocaleString()} waiting
                {backup.failed > 0 ? `, ${backup.failed.toLocaleString()} failed` : ''}
                {backup.not_queued > 0 ? `, ${backup.not_queued.toLocaleString()} not queued` : ''}.
            </p>

            {backup.stuck > 0 && (
                <p className="text-sm text-[#f0b3aa]">
                    {backup.stuck.toLocaleString()} {backup.stuck === 1 ? 'backup has' : 'backups have'} been waiting more than 10 minutes without
                    being tried. The backups worker (the cron job on the server) is probably not running.
                </p>
            )}

            {backup.errors.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {backup.errors.map((item) => (
                        <li key={item.capture_id} className="text-sm">
                            <span className="text-mist/70">
                                Photo #{item.capture_id}
                                {item.guest_name ? ` (${item.guest_name})` : ''} · {item.status === 'failed' ? 'gave up' : 'will retry'} ·{' '}
                                {ago(item.at)}
                            </span>
                            <span className="block text-[#f0b3aa]">{item.error}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flex flex-wrap gap-3">
                <GhostButton type="button" disabled={action.state === 'busy'} onClick={testConnection}>
                    Test connection
                </GhostButton>
                {backup.failed > 0 && (
                    <GhostButton type="button" disabled={action.state === 'busy'} onClick={retryFailed}>
                        Retry failed backups
                    </GhostButton>
                )}
            </div>

            {action.state === 'busy' && <p className="text-mist/60 text-sm">Checking…</p>}
            {action.state === 'done' && <p className={cn('text-sm', action.ok ? 'text-mist/80' : 'text-[#f0b3aa]')}>{action.message}</p>}
        </section>
    );
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

            {stats?.drive_backup.enabled && <DriveBackupSection backup={stats.drive_backup} onLocked={onLocked} />}

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
