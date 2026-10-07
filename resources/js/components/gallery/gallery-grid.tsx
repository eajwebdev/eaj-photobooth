import { GalleryTile, tileRatio } from '@/components/gallery/gallery-tile';
import type { CaptureData } from '@/lib/captures';
import { assignColumns, columnsFor } from '@/lib/masonry';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';

interface GalleryGridProps {
    items: CaptureData[];
    onOpen: (capture: CaptureData) => void;
    hearts?: boolean;
}

function useColumnCount(): number {
    const [count, setCount] = useState(() => (typeof window === 'undefined' ? 2 : columnsFor(window.innerWidth)));

    useEffect(() => {
        const onResize = () => setCount(columnsFor(window.innerWidth));
        window.addEventListener('resize', onResize);

        return () => window.removeEventListener('resize', onResize);
    }, []);

    return count;
}

/**
 * Masonry columns (2 on phones, up to 5 on desktops) in which photos never
 * jump between columns. Plain elements, no layout animation, so it stays
 * smooth with 1,500 photos; only photos that arrive later fade in.
 */
export function GalleryGrid({ items, onOpen, hearts = false }: GalleryGridProps) {
    const columns = useColumnCount();
    const assignments = useRef(new Map<string, number>());
    const initial = useRef<Set<string> | null>(null);

    initial.current ??= new Set(items.map((item) => item.uuid));

    const columnLists = useMemo(() => {
        const next = assignColumns(
            items.map((item) => ({ key: item.uuid, ratio: tileRatio(item) })),
            columns,
            assignments.current,
        );
        assignments.current = next;

        const lists: CaptureData[][] = Array.from({ length: columns }, () => []);
        items.forEach((item) => lists[next.get(item.uuid) ?? 0].push(item));

        return lists;
    }, [columns, items]);

    return (
        <div className="flex items-start gap-3 sm:gap-4" role="list" aria-label="Photos">
            {columnLists.map((list, column) => (
                <div key={column} className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
                    {list.map((capture) => (
                        <div
                            key={capture.uuid}
                            role="listitem"
                            className={cn(!initial.current?.has(capture.uuid) && 'animate-in fade-in slide-in-from-top-3 duration-500')}
                        >
                            <GalleryTile capture={capture} onOpen={onOpen} hearts={hearts} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
