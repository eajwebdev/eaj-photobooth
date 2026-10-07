import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Navy ground with the royal glow from above and the faint gold dot grid. */
export function RoyalBackground({ children, className }: { children?: ReactNode; className?: string }) {
    return <div className={cn('bg-royal-chapel relative isolate min-h-dvh overflow-hidden', className)}>{children}</div>;
}
