/**
 * Stable masonry columns. Every item keeps the column it was first given, so
 * loading more photos (or new ones arriving) never moves a photo the guest is
 * looking at. New items go to whichever column is currently shortest.
 */

export interface MasonryItem {
    key: string;
    /** height ÷ width */
    ratio: number;
}

export function assignColumns(items: MasonryItem[], columns: number, previous: ReadonlyMap<string, number>): Map<string, number> {
    const next = new Map<string, number>();
    const heights = new Array<number>(columns).fill(0);

    for (const item of items) {
        const column = previous.get(item.key);

        if (column !== undefined && column < columns) {
            next.set(item.key, column);
            heights[column] += item.ratio;
        }
    }

    for (const item of items) {
        if (next.has(item.key)) {
            continue;
        }

        const shortest = heights.indexOf(Math.min(...heights));
        next.set(item.key, shortest);
        heights[shortest] += item.ratio;
    }

    return next;
}

/** Columns for a width: 2 on phones, 3 on tablets, 4–5 on desktops. */
export function columnsFor(width: number): number {
    if (width < 640) {
        return 2;
    }

    if (width < 1024) {
        return 3;
    }

    return width < 1536 ? 4 : 5;
}
