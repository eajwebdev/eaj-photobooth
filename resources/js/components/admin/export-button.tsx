import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { ApiError } from '@/lib/api';
import { pinFetch, type ExportStatus, type PinKind } from '@/lib/pin-api';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_MS = 3000;

interface ExportButtonProps {
    pinKind: PinKind;
    kind: 'archive' | 'guestbook';
    label: string;
    readyLabel: string;
    primary?: boolean;
}

/** Starts a queued export, waits for it, then offers the download link. */
export function ExportButton({ pinKind, kind, label, readyLabel, primary = false }: ExportButtonProps) {
    const [status, setStatus] = useState<ExportStatus | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status?.status !== 'pending') {
            return;
        }

        const timer = window.setInterval(() => {
            pinFetch<{ data: ExportStatus }>(pinKind, `/exports/${status.uuid}`)
                .then(({ data }) => setStatus(data))
                .catch(() => undefined);
        }, POLL_MS);

        return () => window.clearInterval(timer);
    }, [pinKind, status]);

    const start = async () => {
        setError(null);

        try {
            const { data } = await pinFetch<{ data: ExportStatus }>(pinKind, '/exports', { method: 'POST', body: JSON.stringify({ kind }) });
            setStatus(data);
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
        }
    };

    const Button = primary ? GoldButton : GhostButton;

    return (
        <div className="flex flex-col items-start gap-2">
            {status?.status === 'ready' && status.download_url ? (
                <GoldButton asChild>
                    <a href={status.download_url}>
                        <Download className="size-5" strokeWidth={1.75} /> {readyLabel}
                    </a>
                </GoldButton>
            ) : (
                <Button type="button" onClick={() => void start()} disabled={status?.status === 'pending'}>
                    {status?.status === 'pending' ? 'Preparing… this can take a few minutes' : label}
                </Button>
            )}
            {status?.status === 'failed' && <p className="text-sm text-[#f0b3aa]">It could not be prepared: {status.error}</p>}
            {error && (
                <p role="alert" className="text-sm text-[#f0b3aa]">
                    {error}
                </p>
            )}
        </div>
    );
}
