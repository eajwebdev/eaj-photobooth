import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

interface LongPressHandlers {
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onClickCapture: (event: MouseEvent) => void;
    onContextMenu: (event: MouseEvent) => void;
}

/**
 * Calls `onLongPress` after the element is held for `durationMs` without lifting.
 * The click that follows a completed long press is swallowed, so it never also
 * counts as an ordinary tap.
 */
export function useLongPress(onLongPress: () => void, durationMs = 3000): LongPressHandlers {
    const timer = useRef<number | undefined>(undefined);
    const fired = useRef(false);
    const callback = useRef(onLongPress);

    useEffect(() => {
        callback.current = onLongPress;
    }, [onLongPress]);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const cancel = useCallback(() => window.clearTimeout(timer.current), []);

    const start = useCallback(
        (event: PointerEvent) => {
            if (event.button !== 0) {
                return;
            }

            fired.current = false;
            cancel();
            timer.current = window.setTimeout(() => {
                fired.current = true;
                callback.current();
            }, durationMs);
        },
        [cancel, durationMs],
    );

    return {
        onPointerDown: start,
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onClickCapture: (event) => {
            if (fired.current) {
                event.preventDefault();
                event.stopPropagation();
                fired.current = false;
            }
        },
        onContextMenu: (event) => event.preventDefault(),
    };
}
