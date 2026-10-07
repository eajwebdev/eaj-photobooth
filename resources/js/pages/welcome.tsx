import { AttractSlides } from '@/components/chapel/attract-slides';
import { GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { KioskShell } from '@/components/chapel/kiosk-shell';
import { Monogram } from '@/components/chapel/monogram';
import { StationSheet } from '@/components/chapel/station-sheet';
import { UploadChip } from '@/components/chapel/upload-chip';
import { useIdle } from '@/hooks/use-idle';
import { useLongPress } from '@/hooks/use-long-press';
import { formatWeddingDate } from '@/lib/format';
import { getStation } from '@/lib/station';
import type { RecentCollage, SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const ATTRACT_AFTER_MS = 60_000;
const STAFF_HOLD_MS = 3000;

// The arch draws itself once per visit, not every time a guest group returns here.
let introPlayed = false;

interface WelcomeProps {
    recent: RecentCollage[];
}

export default function Welcome({ recent }: WelcomeProps) {
    const { photobooth } = usePage<SharedData>().props;
    const reduceMotion = useReducedMotion();
    const { isIdle } = useIdle(ATTRACT_AFTER_MS);
    const [introDone, setIntroDone] = useState(introPlayed);
    const [askStation, setAskStation] = useState(false);
    const stationDeferred = useRef(false);

    const attract = isIdle && recent.length > 0;
    const date = formatWeddingDate(photobooth.wedding_date);

    const finishIntro = useCallback(() => {
        introPlayed = true;
        setIntroDone(true);
    }, []);

    // Safety net: names must appear even if the drawing animation is interrupted.
    useEffect(() => {
        if (introDone) {
            return;
        }

        const timer = window.setTimeout(finishIntro, reduceMotion ? 0 : 2400);

        return () => window.clearTimeout(timer);
    }, [finishIntro, introDone, reduceMotion]);

    // Fresh collages each time the screen falls idle.
    useEffect(() => {
        if (isIdle) {
            router.reload({ only: ['recent'] });
        }
    }, [isIdle]);

    const startBooth = useCallback(() => {
        if (getStation() === null && !stationDeferred.current) {
            setAskStation(true);

            return;
        }

        router.visit('/booth');
    }, []);

    const staffPress = useLongPress(
        useCallback(() => router.visit('/admin'), []),
        STAFF_HOLD_MS,
    );

    const fadeUp = (delay: number) =>
        reduceMotion
            ? {}
            : {
                  initial: { opacity: 0, y: 14 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
              };

    return (
        <KioskShell>
            <Head title="Welcome" />

            <AnimatePresence>
                {attract && (
                    <motion.div
                        key="attract-backdrop"
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 2 } }}
                        exit={{ opacity: 0, transition: { duration: 0.45 } }}
                    >
                        <AttractSlides collages={recent} />
                    </motion.div>
                )}
            </AnimatePresence>

            <main
                onClick={startBooth}
                className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-[clamp(1.25rem,3.2dvh,2.75rem)] text-center"
            >
                <div
                    {...staffPress}
                    onClick={(event) => {
                        event.stopPropagation();
                        startBooth();
                    }}
                    className="w-[min(46vw,26dvh)] max-w-[300px] touch-none"
                >
                    <Monogram draw={!introPlayed} onDrawn={finishIntro} />
                </div>

                <motion.div
                    className="flex flex-col items-center gap-[clamp(1.25rem,3.2dvh,2.75rem)]"
                    animate={{ opacity: attract ? 0 : 1 }}
                    transition={{ duration: attract ? 1.2 : 0.25 }}
                >
                    {introDone && (
                        <>
                            <motion.div className="flex flex-col items-center" {...fadeUp(0)}>
                                <p className="font-display text-gold-light/90 text-[clamp(1.05rem,2.4dvh,1.6rem)] italic">The wedding of</p>
                                <h1 className="font-display text-mist mt-[clamp(0.5rem,1.4dvh,1.25rem)] flex flex-col items-center leading-[1.08] italic">
                                    <span className="text-[clamp(2.4rem,min(11vw,7.2dvh),6.5rem)]">{photobooth.couple.groom}</span>
                                    <span className="text-gold my-[0.08em] text-[clamp(1.6rem,min(7vw,4.4dvh),3.75rem)] not-italic">&amp;</span>
                                    <span className="text-[clamp(2.4rem,min(11vw,7.2dvh),6.5rem)]">{photobooth.couple.bride}</span>
                                </h1>
                            </motion.div>

                            {(date || photobooth.venue) && (
                                <motion.div className="flex flex-col items-center gap-3" {...fadeUp(0.35)}>
                                    <GoldOrnament />
                                    {date && (
                                        <p className="text-gold-light text-[clamp(0.85rem,1.9dvh,1.2rem)] font-medium tracking-[0.14em]">{date}</p>
                                    )}
                                    {photobooth.venue && <p className="text-mist/75 text-[clamp(0.85rem,1.8dvh,1.1rem)]">{photobooth.venue}</p>}
                                </motion.div>
                            )}

                            <motion.div className="flex flex-col items-center gap-2" {...fadeUp(0.6)}>
                                <GoldButton
                                    size="lg"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        startBooth();
                                    }}
                                >
                                    Take photos
                                </GoldButton>
                                <Link
                                    href="/gallery"
                                    onClick={(event) => event.stopPropagation()}
                                    className="text-gold-light decoration-gold/50 hover:decoration-gold inline-flex min-h-12 items-center px-4 text-base underline underline-offset-[6px]"
                                >
                                    See everyone's photos
                                </Link>
                            </motion.div>
                        </>
                    )}
                </motion.div>
            </main>

            <UploadChip />

            <AnimatePresence>{attract && <AttractCatcher key="attract-catcher" />}</AnimatePresence>

            <StationSheet
                open={askStation}
                onSaved={() => {
                    setAskStation(false);
                    router.visit('/booth');
                }}
                onCancel={() => {
                    stationDeferred.current = true;
                    setAskStation(false);
                }}
            />
        </KioskShell>
    );
}

/**
 * A clear layer over everything while idle (the monogram shows through). It
 * stays mounted through its fade-out, so the touch that wakes the screen lands
 * here and never starts a session by accident.
 */
function AttractCatcher() {
    return (
        <motion.div
            className="absolute inset-0 z-20 flex flex-col items-center justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 2 } }}
            exit={{ opacity: 0, transition: { duration: 0.45 } }}
            onClick={(event) => event.stopPropagation()}
        >
            <motion.p
                className="pb-safe font-display text-gold-light mb-[8dvh] text-[clamp(1.4rem,3.4dvh,2.4rem)] italic"
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            >
                Tap to take your photos
            </motion.p>
        </motion.div>
    );
}
