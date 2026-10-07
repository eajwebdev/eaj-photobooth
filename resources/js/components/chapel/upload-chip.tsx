import { useUploadQueue } from '@/hooks/use-upload-queue';
import { processQueue, retryFailed } from '@/lib/upload-queue';
import { CloudUpload } from 'lucide-react';

/**
 * A small staff-facing note on the welcome screen while photos are still on
 * this device. Tapping it tries every waiting upload again straight away.
 */
export function UploadChip() {
    const { waiting, failed } = useUploadQueue();

    if (waiting === 0 && failed === 0) {
        return null;
    }

    const parts = [waiting > 0 ? `${waiting} waiting to upload` : null, failed > 0 ? `${failed} could not upload` : null].filter(Boolean);

    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                void (failed > 0 ? retryFailed() : processQueue(true));
            }}
            className="frosted text-mist/85 absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-4 z-30 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs"
            aria-label={`${parts.join(', ')}. Tap to try again now.`}
        >
            <CloudUpload className="text-gold-light size-4" strokeWidth={1.5} />
            {parts.join(', ')}
        </button>
    );
}
