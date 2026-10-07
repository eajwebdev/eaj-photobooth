import { useBoothCamera } from '@/components/booth/camera-context';
import { CameraVideo } from '@/components/booth/camera-video';
import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { lookFor } from '@/lib/looks';
import { cn } from '@/lib/utils';
import type { LookSlug } from '@/types';
import { Check } from 'lucide-react';
import { motion } from 'motion/react';

interface LookPickerProps {
    looks: LookSlug[];
    selected: LookSlug;
    onSelect: (look: LookSlug) => void;
    onContinue: () => void;
}

/** The looks as live camera tiles from one shared stream; the default is already chosen. */
export function LookPicker({ looks, selected, onSelect, onContinue }: LookPickerProps) {
    const camera = useBoothCamera();
    const live = camera.status === 'ready' && camera.stream !== null;

    return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(1rem,3dvh,2rem)] py-3">
            <div
                role="radiogroup"
                aria-label="Looks"
                className={cn(
                    'grid w-full max-w-[min(100%,calc((100dvh-15rem)*0.8))] grid-cols-2 gap-3 sm:gap-5',
                    looks.length > 2 && 'landscape:max-w-[min(100%,calc((100dvh-14rem)*0.75*4))] landscape:grid-cols-4',
                )}
            >
                {looks.map((slug) => {
                    const look = lookFor(slug);
                    const isSelected = slug === selected;

                    return (
                        <motion.button
                            key={slug}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => onSelect(slug)}
                            whileTap={{ scale: 0.97 }}
                            className="flex flex-col items-center gap-2 text-center"
                        >
                            <span
                                className={cn(
                                    'relative block aspect-[3/4] w-full overflow-hidden rounded-2xl ring-1 transition-[box-shadow] duration-200',
                                    isSelected ? 'ring-gold shadow-[0_0_0_3px_#C9A14A]' : 'ring-gold-light/20',
                                )}
                            >
                                {live ? (
                                    <CameraVideo stream={camera.stream} facing={camera.facing} look={look} className="absolute inset-0" />
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'absolute inset-0 bg-[linear-gradient(160deg,#f0d9b5,#c98f7a_45%,#3a5bb5)]',
                                            camera.status === 'starting' && 'animate-pulse',
                                        )}
                                        style={{ filter: look.cssFilter }}
                                    />
                                )}
                                {isSelected && (
                                    <span className="bg-gold-leaf text-navy absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full">
                                        <Check className="size-4" strokeWidth={2.5} />
                                    </span>
                                )}
                            </span>
                            <span className="font-display text-mist text-xl">{look.name}</span>
                            <span className="text-mist/65 -mt-1.5 hidden text-sm sm:block">{look.description}</span>
                        </motion.button>
                    );
                })}
            </div>

            {(camera.status === 'error' || camera.status === 'unsupported') && camera.error && (
                <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
                    <p className="text-mist/80 text-sm">{camera.error.message}</p>
                    {camera.status === 'error' && (
                        <GhostButton type="button" onClick={() => void camera.start()}>
                            Try again
                        </GhostButton>
                    )}
                </div>
            )}

            <GoldButton size="lg" onClick={onContinue} className="min-w-[14rem]">
                Continue with {lookFor(selected).name}
            </GoldButton>
        </div>
    );
}
