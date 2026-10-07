import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';

interface MonogramProps {
    /** Draw the arch stroke by stroke (~1.8 s) instead of showing it at once. */
    draw?: boolean;
    onDrawn?: () => void;
    className?: string;
    title?: string;
}

const ARCH_DURATION = 1.8;

// A chapel window: straight jambs rising into a semicircular head, closed by a sill.
const OUTER_ARCH = 'M24 292 V128 A96 96 0 0 1 216 128 V292 Z';
const INNER_ARCH = 'M36 282 V128 A84 84 0 0 1 204 128 V282 Z';

/**
 * The signature of the suite: a gold double-line chapel arch framing "E & J".
 * Reused as the app icon, the QR border, page headers and the guestbook cover.
 */
export function Monogram({ draw = false, onDrawn, className, title = 'Edwin and Jochel' }: MonogramProps) {
    const reduceMotion = useReducedMotion();
    const gradientId = `monogram-gold-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const gold = `url(#${gradientId})`;
    const animate = draw && !reduceMotion;

    const stroke = (delay: number) =>
        animate
            ? {
                  initial: { pathLength: 0, opacity: 0 },
                  animate: { pathLength: 1, opacity: 1 },
                  transition: {
                      pathLength: { duration: ARCH_DURATION, delay, ease: [0.65, 0, 0.35, 1] as const },
                      opacity: { duration: 0.2, delay },
                  },
              }
            : {};

    const reveal = (delay: number) =>
        animate
            ? {
                  initial: { opacity: 0, y: 6 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
              }
            : {};

    return (
        <svg viewBox="0 0 240 300" role="img" aria-label={title} className={cn('h-auto w-full overflow-visible', className)}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8D29B" />
                    <stop offset="55%" stopColor="#C9A14A" />
                    <stop offset="100%" stopColor="#A07C2C" />
                </linearGradient>
            </defs>

            <motion.path d={OUTER_ARCH} fill="none" stroke={gold} strokeWidth={2.4} strokeLinejoin="round" {...stroke(0)} />
            <motion.path
                d={INNER_ARCH}
                fill="none"
                stroke="#E8D29B"
                strokeOpacity={0.75}
                strokeWidth={1}
                strokeLinejoin="round"
                {...stroke(0.18)}
                onAnimationComplete={animate ? onDrawn : undefined}
            />

            <motion.g {...reveal(ARCH_DURATION * 0.72)}>
                <path d="M120 14 L127 23 L120 32 L113 23 Z" fill={gold} />

                <text x="72" y="196" textAnchor="middle" fill={gold} style={{ fontFamily: 'var(--font-display)', fontSize: 84, fontWeight: 400 }}>
                    E
                </text>
                <text
                    x="120"
                    y="188"
                    textAnchor="middle"
                    fill="#E8D29B"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontStyle: 'italic', fontWeight: 400 }}
                >
                    &amp;
                </text>
                <text x="170" y="196" textAnchor="middle" fill={gold} style={{ fontFamily: 'var(--font-display)', fontSize: 84, fontWeight: 400 }}>
                    J
                </text>

                <path d="M84 236 H112 M128 236 H156" stroke="#C9A14A" strokeWidth={1} />
                <path d="M120 231 L125 236 L120 241 L115 236 Z" fill="none" stroke="#C9A14A" strokeWidth={1} />
            </motion.g>
        </svg>
    );
}
