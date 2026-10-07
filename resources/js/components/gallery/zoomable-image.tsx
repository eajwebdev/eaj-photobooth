import { useEffect, useRef, useState, type PointerEvent } from 'react';

const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;
const SWIPE_PX = 70;

interface ZoomableImageProps {
    src: string;
    alt: string;
    /** -1 for previous, +1 for next. Only fires while not zoomed in. */
    onSwipe: (direction: -1 | 1) => void;
}

interface Point {
    x: number;
    y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A photo you can pinch to zoom (up to 4×), drag around when zoomed, double-tap
 * to zoom in or out, and swipe sideways to move to the next photo.
 */
export function ZoomableImage({ src, alt, onSwipe }: ZoomableImageProps) {
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
    const [swipeX, setSwipeX] = useState(0);
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<{ startDistance: number; startScale: number; start: Point; startOffset: Point; moved: boolean } | null>(null);
    const lastTap = useRef(0);

    // A new photo always starts un-zoomed.
    useEffect(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setSwipeX(0);
    }, [src]);

    const onPointerDown = (event: PointerEvent) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointers.current.values()];

        gesture.current = {
            startDistance: points.length === 2 ? distance(points[0], points[1]) : 0,
            startScale: scale,
            start: points[0],
            startOffset: offset,
            moved: false,
        };
    };

    const onPointerMove = (event: PointerEvent) => {
        if (!pointers.current.has(event.pointerId) || !gesture.current) {
            return;
        }

        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointers.current.values()];
        const current = gesture.current;

        if (points.length === 2 && current.startDistance > 0) {
            const next = Math.min(MAX_SCALE, Math.max(1, current.startScale * (distance(points[0], points[1]) / current.startDistance)));
            setScale(next);
            current.moved = true;

            if (next === 1) {
                setOffset({ x: 0, y: 0 });
            }

            return;
        }

        const dx = points[0].x - current.start.x;
        const dy = points[0].y - current.start.y;

        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
            current.moved = true;
        }

        if (scale > 1) {
            setOffset({ x: current.startOffset.x + dx, y: current.startOffset.y + dy });
        } else if (Math.abs(dx) > Math.abs(dy)) {
            setSwipeX(dx);
        }
    };

    const onPointerUp = (event: PointerEvent) => {
        const current = gesture.current;
        pointers.current.delete(event.pointerId);

        if (pointers.current.size > 0) {
            // One finger lifted from a pinch: carry on panning from here.
            const remaining = [...pointers.current.values()][0];
            gesture.current = { startDistance: 0, startScale: scale, start: remaining, startOffset: offset, moved: true };

            return;
        }

        gesture.current = null;

        if (scale === 1 && Math.abs(swipeX) > SWIPE_PX) {
            onSwipe(swipeX < 0 ? 1 : -1);
        }

        setSwipeX(0);

        if (!current?.moved) {
            const now = Date.now();

            if (now - lastTap.current < DOUBLE_TAP_MS) {
                setScale(scale > 1 ? 1 : 2.5);
                setOffset({ x: 0, y: 0 });
                lastTap.current = 0;
            } else {
                lastTap.current = now;
            }
        }
    };

    const dragging = swipeX !== 0 || (gesture.current?.moved ?? false);

    return (
        <div
            className="flex size-full touch-none items-center justify-center overflow-hidden select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                data-saveable
                className="max-h-full max-w-full object-contain shadow-[0_20px_50px_rgb(0_0_0/0.5)]"
                style={{
                    transform: `translate(${offset.x + swipeX}px, ${offset.y}px) scale(${scale})`,
                    transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            />
        </div>
    );
}
