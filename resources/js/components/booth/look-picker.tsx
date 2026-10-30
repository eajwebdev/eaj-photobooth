import { useBoothCamera } from '@/components/booth/camera-context';
import { CameraVideo } from '@/components/booth/camera-video';
import { LookLayers } from '@/components/booth/look-layers';
import { LookStrip } from '@/components/booth/look-strip';
import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { lookFor } from '@/lib/looks';
import { cn } from '@/lib/utils';
import type { LookSlug } from '@/types';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface LookPickerProps {
    looks: LookSlug[];
    selected: LookSlug;
    onSelect: (look: LookSlug) => void;
    onContinue: () => void;
}

const SNAPSHOT_WIDTH = 240;
const SNAPSHOT_DELAY_MS = 700;

/** A small still of the live camera for the filter thumbnails, mirrored like the preview. */
function useCameraSnapshot(video: HTMLVideoElement | null, live: boolean, mirror: boolean): string | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!video || !live) {
            return;
        }

        let created: string | null = null;
        const timer = window.setTimeout(() => {
            if (!video.videoWidth || !video.videoHeight) {
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = SNAPSHOT_WIDTH;
            canvas.height = Math.round((SNAPSHOT_WIDTH * video.videoHeight) / video.videoWidth);
            const ctx = canvas.getContext('2d')!;

            if (mirror) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    canvas.width = 0;

                    if (blob) {
                        created = URL.createObjectURL(blob);
                        setUrl(created);
                    }
                },
                'image/jpeg',
                0.8,
            );
        }, SNAPSHOT_DELAY_MS);

        return () => {
            window.clearTimeout(timer);

            if (created) {
                URL.revokeObjectURL(created);
            }
        };
    }, [live, mirror, video]);

    return url;
}

/**
 * Choosing a look: the live camera, large, through the chosen look, and a film
 * strip of every look underneath showing the guest's own face. Phones stack
 * the two; tablets in landscape put them side by side.
 */
export function LookPicker({ looks, selected, onSelect, onContinue }: LookPickerProps) {
    const camera = useBoothCamera();
    const live = camera.status === 'ready' && camera.stream !== null;
    const look = lookFor(selected);

    const [video, setVideo] = useState<HTMLVideoElement | null>(null);
    const snapshot = useCameraSnapshot(video, live, camera.facing === 'user');

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 pt-2 landscape:grid landscape:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] landscape:items-center landscape:gap-8 lg:landscape:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
            {/* The live preview */}
            <div className="[container-type:size] relative flex min-h-0 w-full flex-1 items-center justify-center landscape:h-full">
                <div className="relative aspect-[4/5] w-[min(100cqw,80cqh)] overflow-hidden rounded-[1.75rem] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.7)] ring-1 ring-white/10">
                    {live ? (
                        <CameraVideo ref={setVideo} stream={camera.stream} facing={camera.facing} look={look} className="absolute inset-0" />
                    ) : (
                        <span
                            aria-hidden="true"
                            className={cn(
                                'absolute inset-0 bg-[linear-gradient(160deg,#f0d9b5,#c98f7a_45%,#3a5bb5)]',
                                camera.status === 'starting' && 'animate-pulse',
                            )}
                            style={{ filter: look.cssFilter }}
                        >
                            <LookLayers look={look} />
                        </span>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgb(7_15_43/0.85)] to-transparent px-5 pt-14 pb-4">
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.div
                                key={selected}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.22 }}
                            >
                                <p className="font-display text-mist text-[clamp(1.7rem,4.5dvh,2.4rem)] leading-none italic">{look.name}</p>
                                <p className="text-mist/75 mt-1.5 text-sm">{look.description}</p>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Filters and continue */}
            <div className="flex shrink-0 flex-col gap-4 pb-1 landscape:justify-center">
                <LookStrip looks={looks} selected={selected} onSelect={onSelect} sampleUrl={snapshot} />

                {(camera.status === 'error' || camera.status === 'unsupported') && camera.error && (
                    <div role="alert" className="flex flex-col items-center gap-2 text-center">
                        <p className="text-mist/80 text-sm">{camera.error.message}</p>
                        {camera.status === 'error' && (
                            <GhostButton type="button" onClick={() => void camera.start()}>
                                Try again
                            </GhostButton>
                        )}
                    </div>
                )}

                <GoldButton size="lg" onClick={onContinue} className="w-full">
                    Continue with {look.name}
                </GoldButton>
                <p className="text-mist/55 -mt-2 text-center text-xs">You can change the look again after your photos.</p>
            </div>
        </div>
    );
}
