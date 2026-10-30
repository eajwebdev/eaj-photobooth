import { GuestFields, type GuestDetails } from '@/components/booth/guest-fields';
import { LayoutPreview } from '@/components/booth/layout-preview';
import { LookStrip } from '@/components/booth/look-strip';
import { StickerStudio } from '@/components/booth/sticker-studio';
import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { useObjectUrls } from '@/hooks/use-object-urls';
import { brandFrom } from '@/lib/brand';
import { composeCollage } from '@/lib/compose';
import type { Layout } from '@/lib/layouts';
import { applyStickers } from '@/lib/stickers';
import type { LookSlug, SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { RotateCcw, Sticker } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';

const TEXT_RECOMPOSE_DELAY_MS = 450;
const LOOK_RECOMPOSE_DELAY_MS = 220;

export type { GuestDetails } from '@/components/booth/guest-fields';

interface ReviewScreenProps {
    layout: Layout;
    look: LookSlug;
    shots: (Blob | null)[];
    /** The looks a guest can switch between here; none (or one) hides the filter strip. */
    looks?: LookSlug[];
    onLookChange?: (look: LookSlug) => void;
    details: GuestDetails;
    onDetailsChange: (details: GuestDetails) => void;
    onRetake: (index: number) => void;
    onStartOver: () => void;
    /** Receives the finished full-size collage. */
    onSave: (collage: Blob) => Promise<void>;
    saving: boolean;
    saveError: string | null;
}

/**
 * The review: the finished collage, large, with each photo retakeable, and
 * the guest's name, wish and guestbook signature (all optional).
 */
export function ReviewScreen({
    layout,
    look,
    shots,
    looks = [],
    onLookChange,
    details,
    onDetailsChange,
    onRetake,
    onStartOver,
    onSave,
    saving,
    saveError,
}: ReviewScreenProps) {
    const { photobooth } = usePage<SharedData>().props;
    const brand = useMemo(() => brandFrom(photobooth), [photobooth]);
    const shotUrls = useObjectUrls(shots);

    // The collage as composed, and with the guest's stickers painted in.
    const [collage, setCollage] = useState<Blob | null>(null);
    const [stickered, setStickered] = useState<Blob | null>(null);
    const [studioOpen, setStudioOpen] = useState(false);
    const stickers = useMemo(() => details.stickers ?? [], [details.stickers]);
    const [composing, setComposing] = useState(true);
    const [composeError, setComposeError] = useState(false);
    const [confirmingStartOver, setConfirmingStartOver] = useState(false);
    const [askingWish, setAskingWish] = useState(false);
    const [collageUrl, stickeredUrl] = useObjectUrls(useMemo(() => [collage, stickered], [collage, stickered]));

    const wishId = useId();
    const usesText = layout.style === 'wishcard' || layout.style === 'magazine';
    const latestJob = useRef(0);
    const composeJob = useRef<Promise<Blob | null> | null>(null);

    // Name and wish only change the picture on the magazine and wish card frames.
    const [textForCollage, setTextForCollage] = useState({ guestName: details.guestName, wish: details.wish });

    // Tapping through looks quickly only recomposes for the one the guest stops on.
    const [lookForCollage, setLookForCollage] = useState(look);

    useEffect(() => {
        const timer = window.setTimeout(() => setLookForCollage(look), LOOK_RECOMPOSE_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [look]);

    useEffect(() => {
        if (!usesText) {
            return;
        }

        const timer = window.setTimeout(() => setTextForCollage({ guestName: details.guestName, wish: details.wish }), TEXT_RECOMPOSE_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [details.guestName, details.wish, usesText]);

    const compose = useCallback(
        (text: { guestName: string; wish: string }, lookToUse: LookSlug) => {
            const job = ++latestJob.current;
            setComposing(true);
            setComposeError(false);

            const promise = composeCollage({ layout, shots, look: lookToUse, brand, guestName: text.guestName, wish: text.wish })
                .then((blob) => {
                    if (job === latestJob.current) {
                        setCollage(blob);
                        setComposing(false);
                    }

                    return blob;
                })
                .catch(() => {
                    if (job === latestJob.current) {
                        setComposeError(true);
                        setComposing(false);
                    }

                    return null;
                });

            composeJob.current = promise;

            return promise;
        },
        [brand, layout, shots],
    );

    useEffect(() => {
        void compose(textForCollage, lookForCollage);
    }, [compose, lookForCollage, textForCollage]);

    // Paint the stickers onto the latest collage (full resolution).
    useEffect(() => {
        let alive = true;

        if (!collage || stickers.length === 0) {
            setStickered(null);

            return;
        }

        void applyStickers(collage, stickers).then((blob) => alive && setStickered(blob));

        return () => {
            alive = false;
        };
    }, [collage, stickers]);

    const save = async (overrideWish?: string) => {
        if (layout.style === 'wishcard' && !details.wish.trim() && overrideWish === undefined) {
            setAskingWish(true);

            return;
        }

        setAskingWish(false);

        // Always save a collage that includes the latest name and wish.
        const text = { guestName: details.guestName, wish: overrideWish ?? details.wish };
        const needsFresh =
            look !== lookForCollage || (usesText && (text.guestName !== textForCollage.guestName || text.wish !== textForCollage.wish));
        const finished = needsFresh ? await compose(text, look) : ((await composeJob.current) ?? collage);

        if (finished) {
            await onSave(stickers.length > 0 ? await applyStickers(finished, stickers) : finished);
        }
    };

    const aspect = layout.canvas.w / layout.canvas.h;

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto overscroll-contain pt-2 landscape:flex-row landscape:items-start landscape:justify-center landscape:gap-10 landscape:overflow-hidden">
            {/* The collage */}
            <div
                className="relative w-[min(84vw,30rem,calc(44dvh*var(--aspect)))] shrink-0 drop-shadow-[0_18px_40px_rgb(0_0_0/0.45)] landscape:w-[min(48vw,calc((100dvh-9rem)*var(--aspect)))] landscape:self-center"
                style={{ '--aspect': aspect } as CSSProperties}
            >
                <div style={{ aspectRatio: `${layout.canvas.w} / ${layout.canvas.h}` }} className="relative w-full">
                    {stickeredUrl || collageUrl ? (
                        <img src={stickeredUrl ?? collageUrl ?? undefined} alt="Your collage" data-saveable className="absolute inset-0 size-full" />
                    ) : (
                        <LayoutPreview layout={layout} images={shotUrls} guestName={details.guestName} wish={details.wish} />
                    )}
                    {composing && (
                        <span className="frosted text-mist absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs whitespace-nowrap">
                            {collageUrl ? 'Updating…' : 'Putting your collage together…'}
                        </span>
                    )}
                </div>
                {composeError && (
                    <p role="alert" className="text-mist/80 mt-3 text-center text-sm">
                        The collage could not be finished.{' '}
                        <button type="button" className="text-gold-light underline" onClick={() => void compose(textForCollage, lookForCollage)}>
                            Try again
                        </button>
                    </p>
                )}
            </div>

            {/* Details panel */}
            <div className="flex w-full max-w-md flex-col gap-6 landscape:max-h-full landscape:overflow-y-auto landscape:pr-1">
                {looks.length > 1 && onLookChange && (
                    <section aria-labelledby="review-filter" className="flex flex-col gap-2.5">
                        <h2 id="review-filter" className="text-mist/90 text-sm font-medium">
                            Filter
                        </h2>
                        <LookStrip looks={looks} selected={look} onSelect={onLookChange} sampleUrl={shotUrls[0]} disabled={saving} />
                    </section>
                )}

                <ul className="flex flex-wrap justify-center gap-3" aria-label="Your photos">
                    {shotUrls.map((url, index) => (
                        <li key={index}>
                            <button
                                type="button"
                                onClick={() => onRetake(index)}
                                disabled={saving}
                                aria-label={`Retake photo ${index + 1}`}
                                className="group bg-navy-2 ring-gold-light/25 relative block size-[4.5rem] overflow-hidden rounded-xl ring-1 disabled:opacity-50"
                            >
                                {url && <img src={url} alt="" className="size-full object-cover" />}
                                <span className="bg-gold-leaf text-navy absolute top-1 right-1 flex size-7 items-center justify-center rounded-full">
                                    <RotateCcw className="size-3.5" strokeWidth={2.5} />
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="text-mist/60 -mt-3 text-center text-xs">Tap a photo to retake it</p>

                {photobooth.modules.stickers && (
                    <GhostButton type="button" onClick={() => setStudioOpen(true)} disabled={!collageUrl || saving}>
                        <Sticker className="size-5" strokeWidth={1.5} />
                        {stickers.length > 0 ? `Edit stickers (${stickers.length})` : 'Add stickers'}
                    </GhostButton>
                )}

                <GuestFields details={details} onChange={onDetailsChange} wishInputId={wishId} />

                {saveError && (
                    <p role="alert" className="text-center text-sm text-[#f0b3aa]">
                        {saveError}
                    </p>
                )}

                {/* The main actions stay under the thumb on phones while the guest scrolls the details. */}
                <div className="from-navy via-navy/95 sticky bottom-0 z-10 -mx-4 mt-auto bg-gradient-to-t to-transparent px-4 pt-6 pb-3">
                    <AnimatePresence initial={false} mode="wait">
                        {askingWish ? (
                            <motion.div
                                key="wish"
                                role="alertdialog"
                                aria-label="Add a wish"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="border-gold-light/25 bg-navy-2/70 flex flex-col gap-3 rounded-2xl border p-5 text-center"
                            >
                                <p className="text-mist">This frame prints your wish. Would you like to write one?</p>
                                <div className="flex gap-3">
                                    <GhostButton type="button" className="flex-1" onClick={() => void save('With love')}>
                                        Skip
                                    </GhostButton>
                                    <GoldButton
                                        type="button"
                                        className="flex-1"
                                        onClick={() => {
                                            setAskingWish(false);
                                            document.getElementById(wishId)?.focus();
                                        }}
                                    >
                                        Write a wish
                                    </GoldButton>
                                </div>
                            </motion.div>
                        ) : confirmingStartOver ? (
                            <motion.div
                                key="restart"
                                role="alertdialog"
                                aria-label="Start over?"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="border-gold-light/25 bg-navy-2/70 flex flex-col gap-3 rounded-2xl border p-5 text-center"
                            >
                                <p className="text-mist">Start over? These photos will be removed.</p>
                                <div className="flex gap-3">
                                    <GhostButton type="button" className="flex-1" onClick={() => setConfirmingStartOver(false)}>
                                        Keep them
                                    </GhostButton>
                                    <GoldButton type="button" className="flex-1" onClick={onStartOver}>
                                        Start over
                                    </GoldButton>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="actions"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col gap-3"
                            >
                                <GoldButton type="button" size="lg" onClick={() => void save()} disabled={saving || composeError}>
                                    {saving ? 'Saving…' : 'Save collage'}
                                </GoldButton>
                                <GhostButton type="button" onClick={() => setConfirmingStartOver(true)} disabled={saving}>
                                    Start over
                                </GhostButton>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <StickerStudio
                open={studioOpen}
                collageUrl={collageUrl}
                aspect={aspect}
                placements={stickers}
                onClose={() => setStudioOpen(false)}
                onDone={(placements) => {
                    onDetailsChange({ ...details, stickers: placements });
                    setStudioOpen(false);
                }}
            />
        </div>
    );
}
