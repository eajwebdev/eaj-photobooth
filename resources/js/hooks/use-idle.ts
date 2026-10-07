import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * True once nobody has touched the screen for `timeoutMs`; any touch resets it.
 * `activity` increases on every touch (handy as a key to restart a countdown).
 */
export function useIdle(timeoutMs: number): { isIdle: boolean; activity: number; wake: () => void } {
    const [isIdle, setIsIdle] = useState(false);
    const [activity, setActivity] = useState(0);
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        const restart = () => {
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setIsIdle(true), timeoutMs);
        };

        const onActivity = () => {
            setIsIdle(false);
            setActivity((count) => count + 1);
            restart();
        };

        restart();
        ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

        return () => {
            window.clearTimeout(timer.current);
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
        };
    }, [timeoutMs]);

    return { isIdle, activity, wake: () => setIsIdle(false) };
}
