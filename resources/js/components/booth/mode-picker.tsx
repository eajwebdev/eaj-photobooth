import { GoldOrnament } from '@/components/chapel/gold-ornament';
import type { Challenge } from '@/lib/party';
import type { CaptureMode } from '@/types';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

const MODES: Record<CaptureMode, { title: string; body: string; art: (draw: boolean) => ReactNode }> = {
    collage: {
        title: 'Photo collage',
        body: 'A few photos together in one keepsake frame',
        art: (draw) => <CollageArt draw={draw} />,
    },
    boomerang: {
        title: 'Boomerang',
        body: 'A short clip that plays forwards and back',
        art: (draw) => <BoomerangArt draw={draw} />,
    },
};

interface ModePickerProps {
    modes: CaptureMode[];
    onPick: (mode: CaptureMode) => void;
    /** Photo challenges (party module); picking one starts a session for it. */
    challenges?: Challenge[];
    onPickChallenge?: (challenge: Challenge) => void;
}

/** Two chapel windows, one per way to celebrate. */
export function ModePicker({ modes, onPick, challenges = [], onPickChallenge }: ModePickerProps) {
    const reduceMotion = useReducedMotion();

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center gap-[clamp(1rem,3dvh,2.5rem)] py-4 sm:flex-row sm:py-8">
                {modes.map((mode, index) => {
                    const copy = MODES[mode];

                    return (
                        <motion.button
                            key={mode}
                            type="button"
                            onClick={() => onPick(mode)}
                            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                            whileTap={{ scale: 0.97 }}
                            className="group border-gold-light/30 bg-navy-2/55 hover:border-gold-light/60 relative flex w-full max-w-[22rem] flex-1 flex-col items-center justify-center rounded-t-[999px] rounded-b-[2rem] border px-6 pt-[clamp(2.5rem,7dvh,5rem)] pb-[clamp(1.25rem,3.5dvh,2.5rem)] text-center shadow-[inset_0_0_0_6px_rgb(12_28_69/0.55),inset_0_0_0_7px_rgb(232_210_155/0.16)] transition-colors duration-200 sm:h-[min(34rem,calc(100dvh-10rem))] sm:w-[min(24rem,42vw)] sm:max-w-none sm:flex-none"
                        >
                            <span className="text-gold w-[min(40vw,15dvh,11rem)]">{copy.art(!reduceMotion)}</span>
                            <span className="font-display text-mist mt-[clamp(0.75rem,2.5dvh,1.75rem)] text-[clamp(1.8rem,4.6dvh,2.75rem)] leading-tight italic">
                                {copy.title}
                            </span>
                            <GoldOrnament className="my-3" width="w-8" />
                            <span className="text-mist/75 max-w-[22ch] text-[clamp(0.95rem,2dvh,1.1rem)] leading-snug">{copy.body}</span>
                        </motion.button>
                    );
                })}
            </div>

            {challenges.length > 0 && onPickChallenge && (
                <section aria-label="Take a challenge" className="pb-2">
                    <p className="font-display text-gold-light mb-2 text-center text-xl italic">Or take a challenge</p>
                    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                        {challenges.map((challenge, index) => (
                            <li key={challenge.id} className="shrink-0 snap-center">
                                <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => onPickChallenge(challenge)}
                                    className="bg-mist text-navy flex h-28 w-44 flex-col justify-between rounded-2xl p-4 text-left shadow-[0_10px_24px_rgb(0_0_0/0.35)]"
                                    style={{ rotate: `${((index % 3) - 1) * 1.5}deg` }}
                                >
                                    <span className="font-display text-[1.05rem] leading-snug italic">{challenge.title}</span>
                                    <span className="text-gold-deep text-xs">
                                        {challenge.photos === 1 ? '1 photo so far' : `${challenge.photos} photos so far`}
                                    </span>
                                </motion.button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function drawProps(draw: boolean, delay: number) {
    return draw
        ? {
              initial: { pathLength: 0 },
              animate: { pathLength: 1 },
              transition: { duration: 1.4, delay, ease: [0.65, 0, 0.35, 1] as const },
          }
        : {};
}

/** Three overlapping prints, as if just laid on a table. */
function CollageArt({ draw }: { draw: boolean }) {
    return (
        <svg viewBox="0 0 160 140" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
            <motion.path d="M22 34 L82 22 L94 90 L34 102 Z" {...drawProps(draw, 0.2)} />
            <motion.path d="M30 42 L76 33 L84 76 L38 85 Z" strokeOpacity={0.6} {...drawProps(draw, 0.35)} />
            <motion.path d="M70 40 L132 46 L126 120 L64 114 Z" {...drawProps(draw, 0.5)} />
            <motion.path d="M76 49 L124 54 L120 98 L72 93 Z" strokeOpacity={0.6} {...drawProps(draw, 0.65)} />
            <motion.path d="M90 86 q8 -12 16 0 q8 -12 16 0" strokeOpacity={0.8} {...drawProps(draw, 0.9)} />
            <motion.path d="M46 68 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0" {...drawProps(draw, 0.9)} />
        </svg>
    );
}

/** A looping ribbon with motion marks: forwards, then back again. */
function BoomerangArt({ draw }: { draw: boolean }) {
    return (
        <svg viewBox="0 0 160 140" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
            <motion.path
                d="M80 70 C60 40, 22 42, 22 70 C22 98, 60 100, 80 70 C100 40, 138 42, 138 70 C138 98, 100 100, 80 70"
                {...drawProps(draw, 0.2)}
            />
            <motion.path d="M126 58 L138 70 L150 58" {...drawProps(draw, 1.1)} />
            <motion.path d="M34 82 L22 70 L10 82" {...drawProps(draw, 1.1)} />
            <motion.path d="M62 118 H98 M70 126 H90" strokeOpacity={0.6} {...drawProps(draw, 1.3)} />
            <motion.path d="M66 22 L72 14 M80 20 V10 M94 22 L88 14" strokeOpacity={0.7} {...drawProps(draw, 1.3)} />
        </svg>
    );
}
