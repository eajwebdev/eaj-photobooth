import { GuestFields, type GuestDetails } from '@/components/booth/guest-fields';
import { LookLayers } from '@/components/booth/look-layers';
import { LookStrip } from '@/components/booth/look-strip';
import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { useObjectUrls } from '@/hooks/use-object-urls';
import { BOOMERANG_FRAME, buildBoomerang, type BoomerangClip, type BoomerangFrame } from '@/lib/boomerang';
import { brandFrom } from '@/lib/brand';
import { lookFor } from '@/lib/looks';
import type { LookSlug, SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface BoomerangReviewProps {
    /** The raw burst. Kept while on this screen, so the clip can be remade in another look. */
    frames: ImageBitmap[] | null;
    /** The finished clip (also restored after a reload). */
    clip: BoomerangClip | null;
    look: LookSlug;
    /** The looks a guest can switch between here; none (or one) hides the filter strip. */
    looks?: LookSlug[];
    onLookChange?: (look: LookSlug) => void;
    details: GuestDetails;
    onDetailsChange: (details: GuestDetails) => void;
    onBuilt: (clip: BoomerangClip) => void;
    onTryAgain: () => void;
    onSave: (clip: BoomerangClip) => Promise<void>;
    saving: boolean;
    saveError: string | null;
    frame?: BoomerangFrame;
}

/** A small JPEG of the first raw frame, for the filter thumbnails. */
function useFirstFrameUrl(frames: ImageBitmap[] | null): string | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        const first = frames?.[0];

        if (!first) {
            setUrl(null);

            return;
        }

        let created: string | null = null;
        let alive = true;
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = Math.round((240 * first.height) / first.width);
        canvas.getContext('2d')?.drawImage(first, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
            (blob) => {
                canvas.width = 0;

                if (blob && alive) {
                    created = URL.createObjectURL(blob);
                    setUrl(created);
                }
            },
            'image/jpeg',
            0.8,
        );

        return () => {
            alive = false;

            if (created) {
                URL.revokeObjectURL(created);
            }
        };
    }, [frames]);

    return url;
}

/**
 * Makes the boomerang, plays it on a silent loop, and saves it with the guest's
 * name and wish. Picking another look shows it at once on the first frame and
 * remakes the clip in the background (one build at a time; the last look wins).
 */
export function BoomerangReview({
    frames,
    clip,
    look,
    looks = [],
    onLookChange,
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
    const [building, setBuilding] = useState(false);
    const [clipUrl] = useObjectUrls(useMemo(() => [clip?.clip ?? null], [clip]));
    const sampleUrl = useFirstFrameUrl(frames);
    const firstFrame = useRef<HTMLCanvasElement>(null);
    /** The look the current clip was made in (a restored clip was made in the saved look). */
    const [builtLook, setBuiltLook] = useState<LookSlug | null>(clip ? look : null);

    const clipIsCurrent = clip !== null && builtLook === look;
    const canChangeLook = looks.length > 1 && onLookChange !== undefined && frames !== null;

    // Show the first frame while the clip is being made.
    useEffect(() => {
        const canvas = firstFrame.current;

        if (canvas && frames?.[0]) {
            canvas.width = frames[0].width;
            canvas.height = frames[0].height;
            canvas.getContext('2d')?.drawImage(frames[0], 0, 0);
        }
    }, [frames, clipIsCurrent]);

    // The ref stops a second build starting before the state update lands (and React's dev double effects).
    const buildRunning = useRef(false);

    useEffect(() => {
        if (!frames || building || buildRunning.current || buildError || clipIsCurrent) {
            return;
        }

        const lookAtStart = look;
        buildRunning.current = true;
        setBuilding(true);
        setProgress(0);

        void buildBoomerang({ frames, look: lookAtStart, brand, frame, onProgress: setProgress })
            .then((built) => {
                setBuiltLook(lookAtStart);
                onBuilt(built);
            })
            .catch(() => setBuildError(true))
            .finally(() => {
                buildRunning.current = false;
                setBuilding(false);
            });
    }, [brand, buildError, building, clipIsCurrent, frame, frames, look, onBuilt]);

    const changeLook = (next: LookSlug) => {
        setBuildError(false);
        onLookChange?.(next);
    };

    const isVideo = clip?.mime.startsWith('video/') ?? false;
    const aspect = `${frame.w} / ${frame.h}`;
    const previewLook = lookFor(look);

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto overscroll-contain pt-2 landscape:flex-row landscape:items-start landscape:justify-center landscape:gap-10 landscape:overflow-hidden">
            <div
                className="relative w-[min(80vw,26rem,calc(44dvh*var(--aspect)))] shrink-0 shadow-[0_18px_40px_rgb(0_0_0/0.45)] landscape:w-[min(42vw,calc((100dvh-9rem)*var(--aspect)))] landscape:self-center"
                style={{ '--aspect': frame.w / frame.h } as CSSProperties}
            >
                <div className="bg-navy-2 relative w-full overflow-hidden" style={{ aspectRatio: aspect }}>
                    {clipIsCurrent && clipUrl ? (
                        isVideo ? (
                            <video src={clipUrl} autoPlay loop muted playsInline className="absolute inset-0 size-full" aria-label="Your boomerang" />
                        ) : (
                            <img src={clipUrl} alt="Your boomerang" className="absolute inset-0 size-full" />
                        )
                    ) : (
                        <>
                            {/* The first frame through the chosen look: an instant preview while the clip is made. */}
                            <div
                                aria-hidden="true"
                                className="absolute overflow-hidden"
                                style={{
                                    left: `${(frame.photo.x / frame.w) * 100}%`,
                                    top: `${(frame.photo.y / frame.h) * 100}%`,
                                    width: `${(frame.photo.w / frame.w) * 100}%`,
                                    height: `${(frame.photo.h / frame.h) * 100}%`,
                                }}
                            >
                                <canvas ref={firstFrame} className="size-full" style={{ filter: previewLook.cssFilter }} />
                                <LookLayers look={previewLook} />
                            </div>
                            <div className="frosted absolute inset-x-6 bottom-6 flex flex-col gap-2 rounded-2xl p-4 text-center">
                                <p className="text-mist text-sm" aria-live="polite">
                                    {buildError
                                        ? 'The boomerang could not be made.'
                                        : clip
                                          ? `Remaking it in ${previewLook.name}…`
                                          : 'Making your boomerang…'}
                                </p>
                                {buildError ? (
                                    frames && (
                                        <button type="button" className="text-gold-light text-sm underline" onClick={() => setBuildError(false)}>
                                            Try again
                                        </button>
                                    )
                                ) : (
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

            <div className="flex w-full max-w-md flex-col gap-6 landscape:max-h-full landscape:overflow-y-auto landscape:pr-1">
                {canChangeLook && (
                    <section aria-labelledby="boomerang-filter" className="flex flex-col gap-2.5">
                        <h2 id="boomerang-filter" className="text-mist/90 text-sm font-medium">
                            Filter
                        </h2>
                        <LookStrip looks={looks} selected={look} onSelect={changeLook} sampleUrl={sampleUrl} disabled={saving} />
                    </section>
                )}

                <GuestFields details={details} onChange={onDetailsChange} />

                {saveError && (
                    <p role="alert" className="text-center text-sm text-[#f0b3aa]">
                        {saveError}
                    </p>
                )}

                {/* The main actions stay under the thumb on phones while the guest scrolls the details. */}
                <div className="from-navy via-navy/95 sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-3 bg-gradient-to-t to-transparent px-4 pt-6 pb-3">
                    <GoldButton type="button" size="lg" disabled={!clipIsCurrent || saving} onClick={() => clip && void onSave(clip)}>
                        {saving ? 'Saving…' : clipIsCurrent ? 'Save boomerang' : 'Making your boomerang…'}
                    </GoldButton>
                    <GhostButton type="button" onClick={onTryAgain} disabled={saving}>
                        Record again
                    </GhostButton>
                </div>
            </div>
        </div>
    );
}
