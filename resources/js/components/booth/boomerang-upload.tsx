import { GoldButton } from '@/components/chapel/gold-button';
import { Toggle } from '@/components/chapel/toggle';
import { boomerangAspect, burstFromRecording, type BoomerangFrame } from '@/lib/boomerang';
import type { ShotSource } from '@/lib/session-store';
import { useRef, useState, type ChangeEvent } from 'react';

interface BoomerangUploadProps {
    frame: BoomerangFrame;
    reason: string | null;
    onBurst: (frames: ImageBitmap[], source: ShotSource) => void;
}

/**
 * When the browser cannot show a live camera (no https, or no camera API), the
 * phone's own camera app records a short video and the boomerang is made from it.
 */
export function BoomerangUpload({ frame, reason, onBurst }: BoomerangUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [useBackCamera, setUseBackCamera] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const working = progress !== null;

    const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        setProgress(0);
        setError(null);

        try {
            onBurst(await burstFromRecording(file, setProgress, frame), 'upload');
        } catch {
            setError('That video could not be used. Please record 2–3 seconds and try again.');
        } finally {
            setProgress(null);
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-4 text-center">
            <div
                aria-hidden="true"
                className="border-gold-light/70 bg-navy/40 flex w-[min(40vw,24dvh,12rem)] items-center justify-center rounded-md border-2 border-dashed"
                style={{ aspectRatio: boomerangAspect(frame) }}
            >
                <span className="font-display text-gold-light/80 text-4xl italic">∞</span>
            </div>

            <div className="flex max-w-sm flex-col items-center gap-2">
                <p className="font-display text-gold-light text-2xl italic">Record your boomerang</p>
                <p className="text-mist/75 text-sm">
                    {reason ?? 'The live camera is not available on this device.'} Your phone’s camera app will open: record 2–3 seconds of movement,
                    then tap “Use video”.
                </p>
            </div>

            <GoldButton size="lg" disabled={working} onClick={() => inputRef.current?.click()}>
                {working ? `Making your boomerang… ${Math.round(progress * 100)}%` : 'Record the boomerang'}
            </GoldButton>
            <div className="w-full max-w-xs">
                <Toggle checked={useBackCamera} onChange={setUseBackCamera} label="Use the back camera" />
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="video/*"
                capture={useBackCamera ? 'environment' : 'user'}
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => void onFile(event)}
            />

            {error && (
                <p role="alert" className="text-sm text-[#f0b3aa]">
                    {error}
                </p>
            )}
        </div>
    );
}
