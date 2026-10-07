import { useHearts } from '@/hooks/use-hearts';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

interface HeartButtonProps {
    uuid: string;
    count: number;
    variant?: 'tile' | 'large';
}

/** A heart for a photo: tap to love it (once per phone), tap again to take it back. */
export function HeartButton({ uuid, count, variant = 'tile' }: HeartButtonProps) {
    const { isHearted, countFor, toggle } = useHearts();
    const reduceMotion = useReducedMotion();
    const hearted = isHearted(uuid);
    const shown = countFor(uuid, count);

    return (
        <button
            type="button"
            aria-pressed={hearted}
            aria-label={hearted ? `Remove your heart (${shown})` : `Heart this photo (${shown})`}
            onClick={(event) => {
                event.stopPropagation();
                void toggle(uuid);
            }}
            className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-full',
                variant === 'tile' ? 'frosted min-h-9 min-w-9 px-2.5 text-xs' : 'border-gold-light/40 min-h-12 border px-5 text-base',
                hearted ? 'text-[#f3a6b4]' : 'text-mist/85',
            )}
        >
            <motion.span
                key={String(hearted)}
                initial={reduceMotion || !hearted ? false : { scale: 1.6 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
                <Heart className={variant === 'tile' ? 'size-4' : 'size-5'} fill={hearted ? 'currentColor' : 'none'} strokeWidth={1.75} />
            </motion.span>
            {shown > 0 && <span>{shown}</span>}
        </button>
    );
}
