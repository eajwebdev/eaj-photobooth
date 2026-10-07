import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonSize = 'md' | 'lg';

interface ChapelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    size?: ButtonSize;
}

const sizes: Record<ButtonSize, string> = {
    md: 'min-h-12 px-7 text-base',
    lg: 'min-h-16 px-11 text-lg sm:text-xl',
};

const base =
    'inline-flex select-none items-center justify-center gap-2.5 rounded-full font-sans font-medium tracking-[0.02em] ' +
    'transition-[transform,filter,background-color,border-color] duration-200 ease-chapel active:scale-[0.97] ' +
    'disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-offset-4';

/** The primary call to action: a pill of vertical gold leaf with navy text. */
export const GoldButton = forwardRef<HTMLButtonElement, ChapelButtonProps>(function GoldButton(
    { asChild = false, size = 'md', className, ...props },
    ref,
) {
    const Component = asChild ? Slot : 'button';

    return <Component ref={ref} className={cn(base, sizes[size], 'bg-gold-leaf text-navy hover:brightness-105', className)} {...props} />;
});

/** A quiet secondary action: hairline gold outline on navy. */
export const GhostButton = forwardRef<HTMLButtonElement, ChapelButtonProps>(function GhostButton(
    { asChild = false, size = 'md', className, ...props },
    ref,
) {
    const Component = asChild ? Slot : 'button';

    return (
        <Component
            ref={ref}
            className={cn(
                base,
                sizes[size],
                'border-gold-light/45 text-gold-light hover:border-gold-light/80 hover:bg-gold-light/5 border',
                className,
            )}
            {...props}
        />
    );
});
