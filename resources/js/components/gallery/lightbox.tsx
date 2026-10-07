import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { IconButton } from '@/components/chapel/icon-button';
import { HeartButton } from '@/components/gallery/heart-button';
import { ZoomableImage } from '@/components/gallery/zoomable-image';
import { downloadName, type CaptureData } from '@/lib/captures';
import type { SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Download, Images, Share, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface LightboxProps {
    items: CaptureData[];
    index: number;
    onMove: (index: number) => void;
    onClose: () => void;
    /** Called near the end of the loaded photos, to load more. */
    onNearEnd?: () => void;
    showAlbumLink?: boolean;
    /** Show the heart button (the hearts module is on). */
    hearts?: boolean;
}

/**
 * Full-screen viewer: swipe or use the arrow keys between photos, pinch to
 * zoom, and download or share in full quality. Shows the 1080px preview; the
 * download is the full-size original.
 */
export function Lightbox({ items, index, onMove, onClose, onNearEnd, showAlbumLink = true, hearts = false }: LightboxProps) {
    const { photobooth } = usePage<SharedData>().props;
    const reduceMotion = useReducedMotion();
    const capture = items[index];
    const [canShareFiles, setCanShareFiles] = useState(false);
    const [shareState, setShareState] = useState<'idle' | 'busy' | 'error'>('idle');
    const closeRef = useRef<HTMLButtonElement>(null);

    const go = useCallback(
        (direction: -1 | 1) => {
            const next = index + direction;

            if (next >= 0 && next < items.length) {
                onMove(next);
            }
        },
        [index, items.length, onMove],
    );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                go(-1);
            } else if (event.key === 'ArrowRight') {
                go(1);
            } else if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [go, onClose]);

    // Lock the page behind, and put keyboard focus in the viewer.
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        closeRef.current?.focus();

        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    // Preload the neighbours, and fetch more photos before the end.
    useEffect(() => {
        [items[index - 1], items[index + 1]].forEach((neighbour) => {
            if (neighbour && neighbour.type === 'collage') {
                new Image().src = neighbour.urls.preview;
            }
        });

        if (index >= items.length - 4) {
            onNearEnd?.();
        }
    }, [index, items, onNearEnd]);

    useEffect(() => {
        if (!capture) {
            return;
        }

        const probe = new File([new Blob()], 'probe', { type: capture.mime });
        setCanShareFiles(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
        setShareState('idle');
    }, [capture]);

    if (!capture) {
        return null;
    }

    const fileName = downloadName(capture, photobooth.download_prefix);
    const isVideo = capture.mime.startsWith('video/');

    const share = async () => {
        setShareState('busy');

        try {
            const blob = await (await fetch(capture.urls.media)).blob();
            await navigator.share({ files: [new File([blob], fileName, { type: capture.mime })], title: photobooth.couple.short });
            setShareState('idle');
        } catch (error) {
            setShareState(error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'error');
        }
    };

    return (
        <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={capture.guest_name ? `Photo from ${capture.guest_name}` : 'Photo'}
            className="bg-navy fixed inset-0 z-50 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
        >
            <div className="pt-safe px-safe flex items-center justify-between gap-3">
                <span className="text-mist/70 min-w-12 text-sm" aria-live="polite">
                    {index + 1} of {items.length}
                </span>
                <IconButton ref={closeRef} aria-label="Close" variant="frosted" onClick={onClose}>
                    <X />
                </IconButton>
            </div>

            <div className="relative min-h-0 flex-1 px-2 py-3 sm:px-16">
                <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                        key={capture.uuid}
                        className="absolute inset-0 px-2 py-3 sm:px-16"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {isVideo ? (
                            <SwipeArea onSwipe={go}>
                                <video
                                    src={capture.urls.media}
                                    poster={capture.urls.poster ?? undefined}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="max-h-full max-w-full"
                                />
                            </SwipeArea>
                        ) : (
                            <ZoomableImage
                                src={capture.urls.preview}
                                alt={capture.guest_name ? `Photo from ${capture.guest_name}` : 'Wedding photo'}
                                onSwipe={go}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>

                <IconButton
                    aria-label="Previous photo"
                    variant="frosted"
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    className="absolute top-1/2 left-3 hidden -translate-y-1/2 sm:inline-flex"
                >
                    <ChevronLeft />
                </IconButton>
                <IconButton
                    aria-label="Next photo"
                    variant="frosted"
                    onClick={() => go(1)}
                    disabled={index >= items.length - 1}
                    className="absolute top-1/2 right-3 hidden -translate-y-1/2 sm:inline-flex"
                >
                    <ChevronRight />
                </IconButton>
            </div>

            <div className="pb-safe px-safe flex flex-col items-center gap-3 pt-1 text-center">
                {(capture.guest_name || capture.message) && (
                    <div className="flex max-w-xl flex-col gap-1">
                        {capture.message && <p className="font-display text-mist line-clamp-3 text-lg leading-snug italic">“{capture.message}”</p>}
                        {capture.guest_name && <p className="text-gold-light text-sm">— {capture.guest_name}</p>}
                    </div>
                )}
                <div className="flex w-full max-w-lg flex-wrap items-center justify-center gap-2">
                    <GoldButton asChild>
                        <a href={capture.urls.download} download={fileName}>
                            <Download className="size-5" strokeWidth={1.75} /> Download
                        </a>
                    </GoldButton>
                    {hearts && <HeartButton uuid={capture.uuid} count={capture.hearts_count ?? 0} variant="large" />}
                    {canShareFiles && (
                        <GhostButton type="button" onClick={() => void share()} disabled={shareState === 'busy'}>
                            <Share className="size-5" strokeWidth={1.5} /> Share
                        </GhostButton>
                    )}
                    {showAlbumLink && capture.album && (
                        <GhostButton asChild>
                            <Link href={`/a/${capture.album}`}>
                                <Images className="size-5" strokeWidth={1.5} /> View album
                            </Link>
                        </GhostButton>
                    )}
                </div>
                {shareState === 'error' && (
                    <p role="alert" className="text-sm text-[#f0b3aa]">
                        Sharing did not work on this phone. Use Download instead.
                    </p>
                )}
            </div>
        </motion.div>
    );
}

/** Horizontal swipe for boomerangs (which are not zoomable). */
function SwipeArea({ onSwipe, children }: { onSwipe: (direction: -1 | 1) => void; children: React.ReactNode }) {
    const start = useRef<number | null>(null);

    return (
        <div
            className="flex size-full touch-pan-y items-center justify-center"
            onPointerDown={(event) => (start.current = event.clientX)}
            onPointerUp={(event) => {
                if (start.current !== null && Math.abs(event.clientX - start.current) > 70) {
                    onSwipe(event.clientX < start.current ? 1 : -1);
                }

                start.current = null;
            }}
        >
            {children}
        </div>
    );
}
