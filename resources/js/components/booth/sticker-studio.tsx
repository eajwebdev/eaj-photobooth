import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { IconButton } from '@/components/chapel/icon-button';
import { STICKERS, stickerById, stickerImage, type StickerPlacement } from '@/lib/stickers';
import { cn } from '@/lib/utils';
import { uuid } from '@/lib/uuid';
import { Trash2, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface StickerStudioProps {
    open: boolean;
    /** The finished collage without stickers. */
    collageUrl: string | null;
    aspect: number;
    placements: StickerPlacement[];
    onDone: (placements: StickerPlacement[]) => void;
    onClose: () => void;
}

interface Gesture {
    key: string;
    mode: 'move' | 'transform';
    start: StickerPlacement;
    pointers: Map<number, { x: number; y: number }>;
    startPointers: Map<number, { x: number; y: number }>;
    /** For the corner handle: the sticker centre in screen pixels. */
    centre?: { x: number; y: number };
}

const MIN_WIDTH = 0.08;
const MAX_WIDTH = 0.95;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Drag stickers onto the collage; pinch with two fingers (or use the gold
 * corner handle) to resize and rotate. They are painted into the final image
 * at full resolution.
 */
export function StickerStudio({ open, collageUrl, aspect, placements: initial, onDone, onClose }: StickerStudioProps) {
    const [placements, setPlacements] = useState<StickerPlacement[]>(initial);
    const [history, setHistory] = useState<StickerPlacement[][]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const stage = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const images = useMemo(() => (open ? Object.fromEntries(STICKERS.map((sticker) => [sticker.id, stickerImage(sticker)])) : {}), [open]);

    useEffect(() => {
        if (open) {
            setPlacements(initial);
            setHistory([]);
            setSelected(null);
        }
    }, [initial, open]);

    const commit = (next: StickerPlacement[]) => {
        setHistory((past) => [...past, placements].slice(-40));
        setPlacements(next);
    };

    const add = (id: string) => {
        const placement: StickerPlacement = { key: uuid(), id, x: 0.5, y: 0.45, width: 0.34, rotation: 0 };
        commit([...placements, placement]);
        setSelected(placement.key);
    };

    const update = (key: string, patch: Partial<StickerPlacement>) =>
        setPlacements((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

    const rect = () => stage.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1);

    const begin = (event: ReactPointerEvent, placement: StickerPlacement, mode: Gesture['mode']) => {
        event.stopPropagation();
        (event.target as Element).setPointerCapture?.(event.pointerId);
        setSelected(placement.key);

        const point = { x: event.clientX, y: event.clientY };
        const current = gesture.current;

        if (current && current.key === placement.key && mode === 'move') {
            // A second finger on the same sticker: switch to pinch and rotate.
            current.pointers.set(event.pointerId, point);
            current.startPointers = new Map(current.pointers);
            current.start = placements.find((item) => item.key === placement.key) ?? placement;

            return;
        }

        setHistory((past) => [...past, placements].slice(-40));
        const bounds = rect();
        gesture.current = {
            key: placement.key,
            mode,
            start: placement,
            pointers: new Map([[event.pointerId, point]]),
            startPointers: new Map([[event.pointerId, point]]),
            centre: { x: bounds.left + placement.x * bounds.width, y: bounds.top + placement.y * bounds.height },
        };
    };

    const move = (event: ReactPointerEvent) => {
        const current = gesture.current;

        if (!current || !current.pointers.has(event.pointerId)) {
            return;
        }

        current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const bounds = rect();
        const points = [...current.pointers.values()];
        const starts = [...current.startPointers.values()];

        if (points.length >= 2 && starts.length >= 2) {
            const [a, b] = points;
            const [a0, b0] = starts;
            const scale = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, Math.hypot(b0.x - a0.x, b0.y - a0.y));
            const angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
            update(current.key, { width: clamp(current.start.width * scale, MIN_WIDTH, MAX_WIDTH), rotation: current.start.rotation + angle });

            return;
        }

        const [point] = points;
        const [origin] = starts;

        if (current.mode === 'transform' && current.centre) {
            // The corner handle: distance sets the size, angle sets the rotation.
            const definition = stickerById(current.start.id);
            const startW = current.start.width * bounds.width;
            const startH = startW / (definition?.aspect ?? 1);
            const startRadius = Math.hypot(startW / 2, startH / 2);
            const radius = Math.hypot(point.x - current.centre.x, point.y - current.centre.y);
            const startAngle = Math.atan2(origin.y - current.centre.y, origin.x - current.centre.x);
            const angle = Math.atan2(point.y - current.centre.y, point.x - current.centre.x);
            update(current.key, {
                width: clamp(current.start.width * (radius / Math.max(1, startRadius)), MIN_WIDTH, MAX_WIDTH),
                rotation: current.start.rotation + (angle - startAngle),
            });

            return;
        }

        update(current.key, {
            x: clamp(current.start.x + (point.x - origin.x) / bounds.width, 0, 1),
            y: clamp(current.start.y + (point.y - origin.y) / bounds.height, 0, 1),
        });
    };

    const end = (event: ReactPointerEvent) => {
        const current = gesture.current;

        if (!current) {
            return;
        }

        current.pointers.delete(event.pointerId);

        if (current.pointers.size === 0) {
            gesture.current = null;
        } else {
            // One finger left: carry on moving from here.
            current.startPointers = new Map(current.pointers);
            current.start = placements.find((item) => item.key === current.key) ?? current.start;
        }
    };

    const undo = () => {
        if (history.length === 0) {
            return;
        }

        setPlacements(history[history.length - 1]);
        setHistory(history.slice(0, -1));
    };

    const remove = (key: string) => {
        commit(placements.filter((item) => item.key !== key));
        setSelected(null);
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add stickers"
                    className="bg-navy fixed inset-0 z-50 flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div className="pt-safe px-safe flex items-center justify-between gap-3 pb-2">
                        <GhostButton type="button" onClick={onClose} className="min-h-11 px-5">
                            Cancel
                        </GhostButton>
                        <p className="font-display text-gold-light text-2xl italic">Add stickers</p>
                        <div className="flex gap-1">
                            <IconButton aria-label="Undo" onClick={undo} disabled={history.length === 0}>
                                <Undo2 />
                            </IconButton>
                            <IconButton aria-label="Remove all stickers" onClick={() => commit([])} disabled={placements.length === 0}>
                                <Trash2 />
                            </IconButton>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 items-center justify-center p-3" onPointerDown={() => setSelected(null)}>
                        <div
                            ref={stage}
                            className="relative touch-none shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
                            style={{ aspectRatio: String(aspect), height: `min(100%, calc((100vw - 1.5rem) / ${aspect}))` }}
                            onPointerMove={move}
                            onPointerUp={end}
                            onPointerCancel={end}
                        >
                            {collageUrl && (
                                <img
                                    src={collageUrl}
                                    alt="Your collage"
                                    className="pointer-events-none absolute inset-0 size-full select-none"
                                    draggable={false}
                                />
                            )}
                            {placements.map((placement) => {
                                const definition = stickerById(placement.id);

                                if (!definition) {
                                    return null;
                                }

                                const isSelected = selected === placement.key;

                                return (
                                    <div
                                        key={placement.key}
                                        className="absolute"
                                        style={{
                                            left: `${placement.x * 100}%`,
                                            top: `${placement.y * 100}%`,
                                            width: `${placement.width * 100}%`,
                                            transform: `translate(-50%, -50%) rotate(${placement.rotation}rad)`,
                                        }}
                                    >
                                        <img
                                            src={images[placement.id]}
                                            alt={definition.label}
                                            draggable={false}
                                            onPointerDown={(event) => begin(event, placement, 'move')}
                                            className={cn(
                                                'block w-full cursor-grab touch-none select-none',
                                                isSelected && 'outline-gold-light outline-2 outline-offset-2 outline-dashed',
                                            )}
                                        />
                                        {isSelected && (
                                            <>
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${definition.label}`}
                                                    onPointerDown={(event) => event.stopPropagation()}
                                                    onClick={() => remove(placement.key)}
                                                    className="bg-navy text-mist border-gold-light absolute -top-4 -left-4 flex size-9 items-center justify-center rounded-full border text-lg leading-none"
                                                >
                                                    ×
                                                </button>
                                                <span
                                                    role="slider"
                                                    aria-label={`Resize and turn ${definition.label}`}
                                                    aria-valuenow={Math.round(placement.width * 100)}
                                                    tabIndex={0}
                                                    onPointerDown={(event) => begin(event, placement, 'transform')}
                                                    className="bg-gold-leaf absolute -right-4 -bottom-4 size-9 cursor-nwse-resize touch-none rounded-full border-2 border-white"
                                                />
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pb-safe border-gold-light/15 border-t pt-3">
                        <ul className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" aria-label="Stickers">
                            {STICKERS.map((sticker) => (
                                <li key={sticker.id} className="shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => add(sticker.id)}
                                        aria-label={`Add ${sticker.label}`}
                                        className="bg-navy-2/70 hover:bg-navy-2 flex size-20 items-center justify-center rounded-2xl p-2"
                                    >
                                        {images[sticker.id] && <img src={images[sticker.id]} alt="" className="max-h-full max-w-full" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="px-4 pt-1">
                            <GoldButton type="button" className="w-full" onClick={() => onDone(placements)}>
                                Done
                            </GoldButton>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
