import { cn } from '@/lib/utils';

/** The suite's divider: a gold line, a small diamond, a gold line. */
export function GoldOrnament({ className, width = 'w-14 sm:w-20' }: { className?: string; width?: string }) {
    return (
        <span aria-hidden="true" className={cn('flex items-center justify-center gap-3', className)}>
            <span className={cn('to-gold h-px bg-gradient-to-r from-transparent', width)} />
            <span className="border-gold bg-gold/30 size-[7px] rotate-45 border" />
            <span className={cn('to-gold h-px bg-gradient-to-l from-transparent', width)} />
        </span>
    );
}
