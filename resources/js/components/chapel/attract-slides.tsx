import type { RecentCollage } from '@/types';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const SLIDE_MS = 6000;

/**
 * The idle backdrop: recent collages cross-fading slowly behind a navy veil.
 * Each collage shows whole, like a print, over a blurred wash of itself.
 */
export function AttractSlides({ collages }: { collages: RecentCollage[] }) {
    const [index, setIndex] = useState(0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (collages.length < 2) {
            return;
        }

        const timer = window.setInterval(() => setIndex((current) => (current + 1) % collages.length), SLIDE_MS);

        return () => window.clearInterval(timer);
    }, [collages.length]);

    useEffect(() => {
        const next = collages[(index + 1) % collages.length];

        if (next) {
            new Image().src = next.image;
        }
    }, [collages, index]);

    const current = collages[index % Math.max(collages.length, 1)];

    return (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
            <AnimatePresence initial={false}>
                {current && (
                    <motion.div
                        key={current.uuid}
                        className="absolute inset-0"
                        style={{ backgroundColor: current.color ?? undefined }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.6, ease: 'easeInOut' }}
                    >
                        <img src={current.image} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-2xl" />
                        <motion.img
                            src={current.image}
                            alt=""
                            className="absolute inset-0 m-auto h-[88%] w-auto max-w-[88%] object-contain shadow-2xl shadow-black/50"
                            initial={{ scale: 1 }}
                            animate={{ scale: reduceMotion ? 1 : 1.05 }}
                            transition={{ duration: (SLIDE_MS + 1600) / 1000, ease: 'linear' }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="bg-navy/55 absolute inset-0" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(12_28_69/0.7)_90%)]" />
        </div>
    );
}
