import { cn } from '@/lib/utils';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** Required: icon-only buttons need a spoken name. */
    'aria-label': string;
    variant?: 'plain' | 'frosted';
}

/** A 48px round button for icons; "frosted" floats over camera or photos. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { variant = 'plain', className, type = 'button', ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn(
                'text-gold-light inline-flex size-12 shrink-0 items-center justify-center rounded-full',
                'ease-chapel transition-[transform,background-color] duration-200 active:scale-[0.94] disabled:opacity-40',
                '[&_svg]:size-[22px] [&_svg]:stroke-[1.5]',
                variant === 'frosted' ? 'frosted hover:bg-navy/60' : 'hover:bg-gold-light/10',
                className,
            )}
            {...props}
        />
    );
});
