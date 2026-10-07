import { useBoothCamera } from '@/components/booth/camera-context';
import { CameraVideo } from '@/components/booth/camera-video';
import { framePreviewId } from '@/components/booth/frame-picker';
import { LayoutPreview } from '@/components/booth/layout-preview';
import { GhostButton } from '@/components/chapel/gold-button';
import { IconButton } from '@/components/chapel/icon-button';
import { unlockAudio } from '@/lib/audio';
import { BOOMERANG_FRAME, boomerangAspect, BURST_MS, captureBurst, type BoomerangFrame } from '@/lib/boomerang';
import { layoutGuide, type Rect, type Size } from '@/lib/capture-geometry';
import type { Layout } from '@/lib/layouts';
import { lookFor } from '@/lib/looks';
import { nextPrompts } from '@/lib/poses';
import type { ShotSource } from '@/lib/session-store';
import { playCountdownBeep, playShutter } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { LookSlug, SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { ChevronLeft, SwitchCamera } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const BREATHER_MS = 2000;
const FRONT_FLASH_LEAD_MS = 250;
const FRONT_FLASH_MIN_MS = 300;
const TOP_BAR = 84;
const BOTTOM_BAR = 176;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface CaptureScreenProps {
    /** The collage frame; null when recording a boomerang. */
    layout: Layout | null;
    look: LookSlug;
    /** Object URLs of shots already taken, by slot. */
    shotUrls: (string | null)[];
    /** Retake just this slot, then finish. */
    retakeIndex: number | null;
    onShot: (index: number, blob: Blob, source: ShotSource) => Promise<void>;
    onComplete: () => void;
    onBack: () => void;
    /** Switch to the phone's own camera app when the live camera will not start. */
    onUseUpload: () => void;
    /** Boomerang mode: one tap records a 1.5 s burst instead of photos. */
    onBurst?: (frames: ImageBitmap[], source: ShotSource) => void;
    boomerangFrame?: BoomerangFrame;
    /** A photo challenge replaces the pose prompts. */
    promptOverride?: string | null;
}

interface Flight {
    url: string;
    index: number;
    from: Rect;
    to: Rect;
}

/**
 * The capture screen. One tap on the shutter runs every shot in a row:
 * pose prompt → countdown (with beeps) → front flash → shutter → the photo flies
 * into its slot → a short breather → the next shot.
 */
export function CaptureScreen({
    layout,
    look,
    shotUrls,
    retakeIndex,
    onShot,
    onComplete,
    onBack,
    onUseUpload,
    onBurst,
    boomerangFrame = BOOMERANG_FRAME,
    promptOverride = null,
}: CaptureScreenProps) {
    const { photobooth } = usePage<SharedData>().props;
    const camera = useBoothCamera();
    const reduceMotion = useReducedMotion();

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const cancelled = useRef(false);

    const [screen, setScreen] = useState<Size>({ w: 0, h: 0 });
    const [videoSize, setVideoSize] = useState<Size | null>(null);
    const [running, setRunning] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number>(
        () =>
            retakeIndex ??
            Math.max(
                0,
                shotUrls.findIndex((url) => url === null),
            ),
    );
    const [prompt, setPrompt] = useState<string | null>(null);
    const [count, setCount] = useState<number | null>(null);
    const [frontFlash, setFrontFlash] = useState(false);
    const [shutterFlash, setShutterFlash] = useState(0);
    const [breather, setBreather] = useState(false);
    const [flight, setFlight] = useState<Flight | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const [burstProgress, setBurstProgress] = useState(0);

    const isBoomerang = layout === null;
    const total = layout?.shots ?? 1;
    const slot = layout ? (layout.slots[activeIndex] ?? layout.slots[0]) : null;
    const aspect = slot ? slot.w / slot.h : boomerangAspect(boomerangFrame);
    const lookDef = lookFor(look);

    useLayoutEffect(() => {
        const element = containerRef.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => setScreen({ w: entry.contentRect.width, h: entry.contentRect.height }));
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    useEffect(
        () => () => {
            cancelled.current = true;
        },
        [],
    );

    const geometry = useMemo(() => {
        if (!videoSize || screen.w === 0) {
            return null;
        }

        const safe: Rect = { x: 16, y: TOP_BAR, w: screen.w - 32, h: Math.max(120, screen.h - TOP_BAR - BOTTOM_BAR) };

        return layoutGuide(screen, videoSize, aspect, safe);
    }, [aspect, screen, videoSize]);

    const onVideoSize = useCallback((size: Size) => setVideoSize((current) => (current?.w === size.w && current?.h === size.h ? current : size)), []);

    const pending = useMemo(() => {
        if (isBoomerang) {
            return [0];
        }

        if (retakeIndex !== null) {
            return [retakeIndex];
        }

        return shotUrls.map((url, index) => (url === null ? index : -1)).filter((index) => index >= 0);
    }, [isBoomerang, retakeIndex, shotUrls]);

    /** A boomerang: a soft shutter sound, then 1.5 s of frames while everyone keeps moving. */
    const recordBurst = async (video: HTMLVideoElement): Promise<boolean> => {
        if (photobooth.sounds_enabled) {
            playShutter();
        }

        setRecording(true);
        setBurstProgress(0);

        try {
            const frames = await captureBurst(video, camera.facing === 'user', setBurstProgress, boomerangFrame);
            onBurst?.(frames, camera.facing === 'user' ? 'front' : 'back');

            return true;
        } catch {
            setCaptureError('That boomerang did not work. Tap the button to try again.');

            return false;
        } finally {
            setRecording(false);
        }
    };

    const takeOne = async (index: number): Promise<boolean> => {
        const video = videoRef.current;

        if (!video) {
            return false;
        }

        if (!layout) {
            return recordBurst(video);
        }

        const flashOn = camera.facing === 'user' && photobooth.front_flash_enabled;
        const flashStarted = performance.now();

        if (flashOn) {
            setFrontFlash(true);
            await sleep(FRONT_FLASH_LEAD_MS);
        }

        let blob: Blob;

        try {
            blob = await camera.capture(video, layout.slots[index].w / layout.slots[index].h);
        } catch {
            setFrontFlash(false);
            setCaptureError('That photo did not work. Tap the button to try again.');

            return false;
        }

        if (flashOn) {
            await sleep(Math.max(0, FRONT_FLASH_MIN_MS - (performance.now() - flashStarted)));
            setFrontFlash(false);
        }

        setShutterFlash((value) => value + 1);

        if (photobooth.sounds_enabled) {
            playShutter();
        }

        const url = URL.createObjectURL(blob);
        const target = previewRef.current?.getBoundingClientRect();
        const origin = containerRef.current?.getBoundingClientRect();

        if (geometry && target && origin && !reduceMotion) {
            setFlight({
                url,
                index,
                from: geometry.guide,
                to: { x: target.x - origin.x, y: target.y - origin.y, w: target.width, h: target.height },
            });
        } else {
            URL.revokeObjectURL(url);
        }

        await onShot(index, blob, camera.facing === 'user' ? 'front' : 'back');

        return true;
    };

    const run = async () => {
        if (running || pending.length === 0 || !videoRef.current) {
            return;
        }

        unlockAudio();
        setCaptureError(null);
        setRunning(true);

        const prompts = promptOverride ? pending.map(() => promptOverride) : nextPrompts(photobooth.pose_prompts, pending.length);
        let completed = true;

        for (let k = 0; k < pending.length; k++) {
            const index = pending[k];
            setActiveIndex(index);
            setPrompt(prompts[k]);

            for (let n = Math.max(1, photobooth.countdown_seconds); n >= 1; n--) {
                if (cancelled.current) {
                    return;
                }

                setCount(n);

                if (photobooth.sounds_enabled) {
                    playCountdownBeep();
                }

                await sleep(1000);
            }

            setCount(null);

            if (cancelled.current || !(await takeOne(index))) {
                completed = false;
                break;
            }

            setPrompt(null);

            if (k < pending.length - 1) {
                setBreather(true);
                await sleep(BREATHER_MS);
                setBreather(false);
            }
        }

        if (cancelled.current) {
            return;
        }

        setPrompt(null);
        setCount(null);
        setRunning(false);

        if (completed) {
            onComplete();
        }
    };

    const takenCount = shotUrls.filter(Boolean).length;
    const shotNumber = retakeIndex !== null ? retakeIndex + 1 : Math.min(takenCount + 1, total);
    const hint = isBoomerang
        ? `Records ${BURST_MS / 1000} seconds. Keep moving!`
        : retakeIndex !== null
          ? 'Retakes this photo'
          : pending.length > 1
            ? `Takes ${pending.length} in a row`
            : 'Takes 1 photo';

    const previewImages = shotUrls.map((url, index) => (flight?.index === index ? null : url));

    return (
        <div ref={containerRef} className="bg-navy absolute inset-0 overflow-hidden">
            <CameraVideo
                ref={videoRef}
                stream={camera.stream}
                facing={camera.facing}
                look={lookDef}
                rect={geometry?.video ?? null}
                onVideoSize={onVideoSize}
                className="absolute inset-0"
            />

            {geometry && (
                <div
                    aria-hidden="true"
                    className="border-gold-light pointer-events-none absolute border-2 shadow-[0_0_0_200vmax_rgb(12_28_69/0.5)]"
                    style={{ left: geometry.guide.x, top: geometry.guide.y, width: geometry.guide.w, height: geometry.guide.h }}
                >
                    <GuideCorners />
                </div>
            )}

            {/* Top bar */}
            <div className="pt-safe px-safe absolute inset-x-0 top-0 flex items-center justify-between gap-3">
                <IconButton aria-label="Back" variant="frosted" onClick={onBack} disabled={running}>
                    <ChevronLeft />
                </IconButton>
                <div className="frosted flex flex-col items-center gap-1.5 rounded-full px-5 py-2">
                    <p className="text-mist text-base leading-none">{isBoomerang ? 'Boomerang' : `Photo ${shotNumber} of ${total}`}</p>
                    {total > 1 && (
                        <span className="flex gap-1.5" aria-hidden="true">
                            {Array.from({ length: total }, (_, index) => (
                                <span
                                    key={index}
                                    className={cn(
                                        'size-1.5 rounded-full transition-colors duration-300',
                                        shotUrls[index] ? 'bg-gold' : index === activeIndex && running ? 'bg-gold-light' : 'bg-mist/30',
                                    )}
                                />
                            ))}
                        </span>
                    )}
                </div>
                {camera.canSwitch ? (
                    <IconButton aria-label="Switch camera" variant="frosted" onClick={() => void camera.switchCamera()} disabled={running}>
                        <SwitchCamera />
                    </IconButton>
                ) : (
                    <span className="size-12" />
                )}
            </div>

            {/* Pose prompt and countdown, centred on the guide */}
            {geometry && (
                <div
                    className="pointer-events-none absolute flex flex-col items-center justify-center gap-4 text-center"
                    style={{ left: geometry.guide.x, top: geometry.guide.y, width: geometry.guide.w, height: geometry.guide.h }}
                >
                    <AnimatePresence mode="popLayout">
                        {prompt && (
                            <motion.p
                                key={prompt}
                                className="font-display max-w-[16ch] px-4 text-[clamp(1.8rem,min(7vw,5dvh),3.5rem)] leading-tight text-white italic [text-shadow:0_2px_18px_rgb(12_28_69/0.85)]"
                                initial={reduceMotion ? false : { opacity: 0, y: -18, scale: 0.92 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                            >
                                {prompt}
                            </motion.p>
                        )}
                    </AnimatePresence>
                    <div aria-live="assertive" className="relative flex h-[clamp(6rem,22dvh,13rem)] items-center justify-center">
                        <AnimatePresence mode="popLayout">
                            {count !== null && (
                                <motion.span
                                    key={count}
                                    className="font-display text-gold-light text-[clamp(6rem,24dvh,14rem)] leading-none [text-shadow:0_4px_30px_rgb(12_28_69/0.8)]"
                                    initial={reduceMotion ? false : { opacity: 0, scale: 1.7 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.6 }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                                >
                                    {count}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        {recording && (
                            <motion.p
                                className="font-display text-[clamp(2rem,6dvh,3.2rem)] text-white italic [text-shadow:0_2px_18px_rgb(12_28_69/0.85)]"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                Keep moving!
                            </motion.p>
                        )}
                        {breather && (
                            <motion.p
                                className="font-display text-[clamp(1.6rem,4dvh,2.6rem)] text-white italic [text-shadow:0_2px_18px_rgb(12_28_69/0.85)]"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                Lovely. Next pose…
                            </motion.p>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom: camera label, shutter, hint */}
            <div className="pb-safe absolute inset-x-0 bottom-0 flex flex-col items-center gap-3">
                {captureError && (
                    <p role="alert" className="frosted text-mist rounded-full px-5 py-2 text-sm">
                        {captureError}
                    </p>
                )}
                <p className={cn('text-mist/85 text-sm transition-opacity', running && 'opacity-0')}>{hint}</p>
                <Shutter
                    disabled={running || camera.status !== 'ready'}
                    onPress={() => void run()}
                    label={isBoomerang ? 'Record the boomerang' : pending.length > 1 ? 'Take the photos' : 'Take the photo'}
                    progress={recording ? burstProgress : null}
                />
                <p className="frosted text-mist/80 rounded-full px-4 py-1.5 text-xs">{camera.facing === 'user' ? 'Front camera' : 'Back camera'}</p>
            </div>

            {layout && (
                <motion.div
                    ref={previewRef}
                    layoutId={framePreviewId(layout.slug)}
                    className="frosted absolute right-4 bottom-[max(env(safe-area-inset-bottom),1rem)] w-[min(20vw,7rem)] rounded-lg p-1.5"
                >
                    <LayoutPreview layout={layout} images={previewImages} activeSlot={running || retakeIndex !== null ? activeIndex : undefined} />
                </motion.div>
            )}

            {(camera.status === 'starting' || camera.status === 'error') && (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div role="alert" className="frosted flex max-w-md flex-col items-center gap-4 rounded-3xl p-6 text-center">
                        {camera.status === 'starting' ? (
                            <p className="text-mist">Opening the camera…</p>
                        ) : (
                            <>
                                <p className="text-mist">{camera.error?.message}</p>
                                <GhostButton type="button" onClick={() => void camera.start()}>
                                    Try again
                                </GhostButton>
                                <button type="button" onClick={onUseUpload} className="text-gold-light min-h-12 text-sm underline underline-offset-4">
                                    Use the phone’s camera app instead
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Front flash: a full white screen lights faces in a dim reception. */}
            {frontFlash && <div aria-hidden="true" className="absolute inset-0 z-40 bg-white" />}

            <AnimatePresence>
                {shutterFlash > 0 && (
                    <motion.div
                        key={shutterFlash}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-30 bg-white"
                        initial={{ opacity: reduceMotion ? 0 : 0.85 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                    />
                )}
            </AnimatePresence>

            {flight && (
                <motion.img
                    key={flight.url}
                    src={flight.url}
                    alt=""
                    className="pointer-events-none absolute z-20 object-cover shadow-2xl"
                    initial={{ left: flight.from.x, top: flight.from.y, width: flight.from.w, height: flight.from.h, opacity: 1 }}
                    animate={{ left: flight.to.x, top: flight.to.y, width: flight.to.w, height: flight.to.h, opacity: 0.2 }}
                    transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
                    onAnimationComplete={() => {
                        URL.revokeObjectURL(flight.url);
                        setFlight(null);
                    }}
                />
            )}
        </div>
    );
}

/** Small gold corner marks on the guide, like a viewfinder. */
function GuideCorners() {
    const corner = 'absolute size-5 border-gold';

    return (
        <>
            <span className={cn(corner, '-top-1 -left-1 border-t-[3px] border-l-[3px]')} />
            <span className={cn(corner, '-top-1 -right-1 border-t-[3px] border-r-[3px]')} />
            <span className={cn(corner, '-bottom-1 -left-1 border-b-[3px] border-l-[3px]')} />
            <span className={cn(corner, '-right-1 -bottom-1 border-r-[3px] border-b-[3px]')} />
        </>
    );
}

/** The 88px shutter: a gold ring around a gold-leaf button; the ring fills while a boomerang records. */
function Shutter({ onPress, disabled, label, progress }: { onPress: () => void; disabled: boolean; label: string; progress: number | null }) {
    const circumference = 2 * Math.PI * 42;

    return (
        <motion.button
            type="button"
            aria-label={label}
            onClick={onPress}
            disabled={disabled}
            whileTap={{ scale: 0.92 }}
            className={cn(
                'border-gold-light bg-navy/30 relative flex size-[88px] items-center justify-center rounded-full border-[3px] shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-sm transition-opacity',
                progress === null && 'disabled:opacity-40',
            )}
        >
            <span className="bg-gold-leaf size-[68px] rounded-full" />
            {progress !== null && (
                <svg aria-hidden="true" viewBox="0 0 88 88" className="absolute -inset-[3px] size-[88px] -rotate-90">
                    <circle
                        cx="44"
                        cy="44"
                        r="42"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - progress)}
                    />
                </svg>
            )}
        </motion.button>
    );
}
