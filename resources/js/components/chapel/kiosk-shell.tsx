import { RoyalBackground } from '@/components/chapel/royal-background';
import { useKiosk } from '@/hooks/use-kiosk';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/**
 * The frame every booth screen lives in: exactly one screen tall (100dvh),
 * clear of notches and home bars, with no selection or long-press menus.
 */
export function KioskShell({ children, className }: { children: ReactNode; className?: string }) {
    useKiosk();

    return (
        <RoyalBackground className="kiosk h-dvh min-h-0">
            <div className={cn('pt-safe pb-safe px-safe relative flex h-full flex-col', className)}>{children}</div>
        </RoyalBackground>
    );
}
