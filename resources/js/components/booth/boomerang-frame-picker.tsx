import { BOOMERANG_FRAMES, type BoomerangFrame } from '@/lib/boomerang';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { motion } from 'motion/react';

/** Three boomerang frames: classic portrait, a tall story and a square feed post. */
export function BoomerangFramePicker({ onPick }: { onPick: (frame: BoomerangFrame) => void }) {
    const { photobooth } = usePage<SharedData>().props;

    return (
        <ul className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 content-center gap-3 overflow-y-auto py-4 sm:grid-cols-3 sm:items-end sm:gap-8 sm:py-6">
            {Object.values(BOOMERANG_FRAMES).map((frame) => (
                <li key={frame.id}>
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onPick(frame)}
                        aria-label={`${frame.name}: ${frame.description}`}
                        className="bg-navy-2/45 flex w-full items-center gap-4 rounded-2xl p-3 text-left ring-1 ring-white/8 sm:flex-col sm:gap-3 sm:bg-transparent sm:p-0 sm:text-center sm:ring-0"
                    >
                        <span
                            className="bg-navy ring-gold-light/20 relative block w-[4.5rem] shrink-0 shadow-[0_14px_30px_rgb(0_0_0/0.45)] ring-1 sm:w-full"
                            style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
                        >
                            <span
                                className="border-gold-light/80 absolute border bg-[linear-gradient(160deg,#34509F,#16296A)]"
                                style={{
                                    left: `${(frame.photo.x / frame.w) * 100}%`,
                                    top: `${(frame.photo.y / frame.h) * 100}%`,
                                    width: `${(frame.photo.w / frame.w) * 100}%`,
                                    height: `${(frame.photo.h / frame.h) * 100}%`,
                                }}
                            />
                            <span
                                className="font-display text-mist absolute inset-x-0 flex items-center justify-center text-[clamp(0.4rem,1.6vw,0.9rem)] italic"
                                style={{ top: `${(frame.footer.y / frame.h) * 100}%`, height: `${(frame.footer.h / frame.h) * 100}%` }}
                            >
                                {photobooth.couple.short}
                            </span>
                        </span>
                        <span className="flex flex-col gap-1 sm:items-center">
                            <span className="font-display text-mist text-xl">{frame.name}</span>
                            <span className="text-gold-light text-sm">{frame.description}</span>
                        </span>
                    </motion.button>
                </li>
            ))}
        </ul>
    );
}
