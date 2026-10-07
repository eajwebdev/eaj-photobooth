import { LayoutPreview } from '@/components/booth/layout-preview';
import { GoldButton } from '@/components/chapel/gold-button';
import { Toggle } from '@/components/chapel/toggle';
import { shotFromFile } from '@/lib/capture';
import type { Layout } from '@/lib/layouts';
import type { ShotSource } from '@/lib/session-store';
import { useRef, useState, type ChangeEvent } from 'react';

interface UploadFallbackProps {
    layout: Layout;
    shotUrls: (string | null)[];
    reason: string | null;
    retakeIndex: number | null;
    onShot: (index: number, blob: Blob, source: ShotSource) => Promise<void>;
    onComplete: () => void;
}

/**
 * When the browser cannot show a live camera (no https, or no camera API), the
 * phone's own camera app takes each photo instead.
 */
export function UploadFallback({ layout, shotUrls, reason, retakeIndex, onShot, onComplete }: UploadFallbackProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [useBackCamera, setUseBackCamera] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const nextIndex = retakeIndex ?? shotUrls.findIndex((url) => url === null);
    const done = nextIndex === -1;

    const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || nextIndex < 0) {
            return;
        }

        setWorking(true);
        setError(null);

        try {
            const slot = layout.slots[nextIndex];
            await onShot(nextIndex, await shotFromFile(file, slot.w / slot.h), 'upload');

            const remaining = retakeIndex !== null ? 0 : shotUrls.filter((url, index) => url === null && index !== nextIndex).length;

            if (remaining === 0) {
                onComplete();
            }
        } catch {
            setError('That photo could not be opened. Please take it again.');
        } finally {
            setWorking(false);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-4 text-center">
            <div className="w-[min(48vw,30dvh,16rem)]">
                <LayoutPreview layout={layout} images={shotUrls} activeSlot={done ? undefined : nextIndex} />
            </div>

            <div className="flex max-w-sm flex-col items-center gap-2">
                <p className="font-display text-gold-light text-2xl italic">
                    {done ? 'All photos taken' : `Photo ${nextIndex + 1} of ${layout.shots}`}
                </p>
                <p className="text-mist/75 text-sm">
                    {reason ?? 'The live camera is not available on this device.'} Your phone’s camera app will open for each photo.
                </p>
            </div>

            {!done && (
                <>
                    <GoldButton size="lg" disabled={working} onClick={() => inputRef.current?.click()}>
                        {working ? 'Adding your photo…' : `Take photo ${nextIndex + 1}`}
                    </GoldButton>
                    <div className="w-full max-w-xs">
                        <Toggle checked={useBackCamera} onChange={setUseBackCamera} label="Use the back camera" />
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        capture={useBackCamera ? 'environment' : 'user'}
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(event) => void onFile(event)}
                    />
                </>
            )}

            {error && (
                <p role="alert" className="text-sm text-[#f0b3aa]">
                    {error}
                </p>
            )}
        </div>
    );
}
