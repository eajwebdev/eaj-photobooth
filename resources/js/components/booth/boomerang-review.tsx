import { GuestFields, type GuestDetails } from '@/components/booth/guest-fields';
import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { useObjectUrls } from '@/hooks/use-object-urls';
import { BOOMERANG_FRAME, buildBoomerang, type BoomerangClip, type BoomerangFrame } from '@/lib/boomerang';
import { brandFrom } from '@/lib/brand';
import type { LookSlug, SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface BoomerangReviewProps {
    /** The raw burst, while the clip still has to be made. */
    frames: ImageBitmap[] | null;
    /** The finished clip (also restored after a reload). */
    clip: BoomerangClip | null;
    look: LookSlug;
    details: GuestDetails;
    onDetailsChange: (details: GuestDetails) => void;
    onBuilt: (clip: BoomerangClip) => void;
    onTryAgain: () => void;
    onSave: (clip: BoomerangClip) => Promise<void>;
    saving: boolean;
    saveError: string | null;
    frame?: BoomerangFrame;
}

/** Makes the boomerang, plays it on a silent loop, and saves it with the guest's name and wish. */
export function BoomerangReview({
    frames,
    clip,
    look,
    details,
    onDetailsChange,
    onBuilt,
    onTryAgain,
    onSave,
    saving,
    saveError,
    frame = BOOMERANG_FRAME,
}: BoomerangReviewProps) {
    const { photobooth } = usePage<SharedData>().props;
    const brand = useMemo(() => brandFrom(photobooth), [photobooth]);
    const [progress, setProgress] = useState(0);
    const [buildError, setBuildError] = useState(false);
    const [clipUrl] = useObjectUrls(useMemo(() => [clip?.clip ?? null], [clip]));
    const firstFrame = useRef<HTMLCanvasElement>(null);
    const building = useRef(false);

    // Show the first frame while the clip is being made.
    useEffect(() => {
        const canvas = firstFrame.current;

        if (canvas && frames?.[0]) {
            canvas.width = frames[0].width;
            canvas.height = frames[0].height;
            canvas.getContext('2d')?.drawImage(frames[0], 0, 0);
        }
    }, [frames]);

    useEffect(() => {
        if (clip || !frames || building.current) {
            return;
        }

        building.current = true;
        setBuildError(false);

        void buildBoomerang({ frames, look, brand, frame, onProgress: setProgress })
            .then(onBuilt)
            .catch(() => setBuildError(true))
            .finally(() => {
                building.current = false;
            });
    }, [brand, clip, frame, frames, look, onBuilt]);

    const isVideo = clip?.mime.startsWith('video/') ?? false;
    const aspect = `${frame.w} / ${frame.h}`;

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto overscroll-contain pt-2 pb-6 landscape:flex-row landscape:items-start landscape:justify-center landscape:gap-10 landscape:overflow-hidden">
            <div
                className="relative w-[min(80vw,26rem,calc(46dvh*var(--aspect)))] shrink-0 shadow-[0_18px_40px_rgb(0_0_0/0.45)] landscape:w-[min(42vw,calc((100dvh-9rem)*var(--aspect)))] landscape:self-center"
                style={{ '--aspect': frame.w / frame.h } as CSSProperties}
            >
                <div className="bg-navy-2 relative w-full overflow-hidden" style={{ aspectRatio: aspect }}>
                    {clip && clipUrl ? (
                        isVideo ? (
                            <video src={clipUrl} autoPlay loop muted playsInline className="absolute inset-0 size-full" aria-label="Your boomerang" />
                        ) : (
                            <img src={clipUrl} alt="Your boomerang" className="absolute inset-0 size-full" />
                        )
                    ) : (
                        <>
                            <canvas
                                ref={firstFrame}
                                aria-hidden="true"
                                className="absolute"
                                style={{
                                    left: `${(frame.photo.x / frame.w) * 100}%`,
                                    top: `${(frame.photo.y / frame.h) * 100}%`,
                                    width: `${(frame.photo.w / frame.w) * 100}%`,
                                    height: `${(frame.photo.h / frame.h) * 100}%`,
                                }}
                            />
                            <div className="frosted absolute inset-x-6 bottom-6 flex flex-col gap-2 rounded-2xl p-4 text-center">
                                <p className="text-mist text-sm" aria-live="polite">
                                    {buildError ? 'The boomerang could not be made.' : 'Making your boomerang…'}
                                </p>
                                {!buildError && (
                                    <span className="bg-navy block h-1.5 overflow-hidden rounded-full">
                                        <span
                                            className="bg-gold block h-full transition-[width] duration-300"
                                            style={{ width: `${Math.round(progress * 100)}%` }}
                                        />
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex w-full max-w-md flex-col gap-6 landscape:max-h-full landscape:overflow-y-auto landscape:pr-1 landscape:pb-6">
                <GuestFields details={details} onChange={onDetailsChange} />

                {saveError && (
                    <p role="alert" className="text-center text-sm text-[#f0b3aa]">
                        {saveError}
                    </p>
                )}

                <div className="flex flex-col gap-3">
                    <GoldButton type="button" size="lg" disabled={!clip || saving} onClick={() => clip && void onSave(clip)}>
                        {saving ? 'Saving…' : 'Save boomerang'}
                    </GoldButton>
                    <GhostButton type="button" onClick={onTryAgain} disabled={saving}>
                        Try again
                    </GhostButton>
                </div>
            </div>
        </div>
    );
}
