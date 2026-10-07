import { BOOMERANG_FRAMES, type BoomerangFrame } from '@/lib/boomerang';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { motion } from 'motion/react';

/** Three boomerang frames: classic portrait, a tall story and a square feed post. */
export function BoomerangFramePicker({ onPick }: { onPick: (frame: BoomerangFrame) => void }) {
    const { photobooth } = usePage<SharedData>().props;

    return (
        <ul className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-3 content-center items-end gap-4 py-6 sm:gap-8">
            {Object.values(BOOMERANG_FRAMES).map((frame) => (
                <li key={frame.id}>
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onPick(frame)}
                        aria-label={`${frame.name}: ${frame.description}`}
                        className="flex w-full flex-col items-center gap-3 text-center"
                    >
                        <span
                            className="bg-navy ring-gold-light/20 relative block w-full shadow-[0_14px_30px_rgb(0_0_0/0.45)] ring-1"
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
                                className="font-display text-mist absolute inset-x-0 flex items-center justify-center text-[clamp(0.55rem,1.6vw,0.9rem)] italic"
                                style={{ top: `${(frame.footer.y / frame.h) * 100}%`, height: `${(frame.footer.h / frame.h) * 100}%` }}
                            >
                                {photobooth.couple.short}
                            </span>
                        </span>
                        <span className="font-display text-mist text-xl">{frame.name}</span>
                        <span className="text-gold-light -mt-2 text-sm">{frame.description}</span>
                    </motion.button>
                </li>
            ))}
        </ul>
    );
}
