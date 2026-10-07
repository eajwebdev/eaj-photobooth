/** Frame definitions as served by /api/layouts and the booth page (from database/data/layouts.json). */

export type LayoutTheme = 'white' | 'royal' | 'film';

export type LayoutStyle = 'polaroid' | 'heirloom' | 'cinema' | 'magazine' | 'stamp' | 'wishcard';

export type LayoutCategory = 'classic' | 'strips' | 'social' | 'playful';

export interface LayoutSlot {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Rotation in degrees around the slot centre. */
    r?: number;
    shape?: 'arch' | 'circle';
}

export interface Layout {
    slug: string;
    name: string;
    description: string | null;
    category: LayoutCategory;
    shots: number;
    canvas: { w: number; h: number };
    theme: LayoutTheme;
    style: LayoutStyle | null;
    slots: LayoutSlot[];
    footer: { y: number; h: number };
    text: { y: number; h: number } | null;
    sort_order: number;
    is_active: boolean;
}

export const LAYOUT_CATEGORIES: { value: LayoutCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'classic', label: 'Classic' },
    { value: 'strips', label: 'Strips' },
    { value: 'social', label: 'Social' },
    { value: 'playful', label: 'Playful' },
];

/** SVG path for a rectangle with a semicircular top (radius w/2): the chapel arch. */
export function archPath({ x, y, w, h }: Pick<LayoutSlot, 'x' | 'y' | 'w' | 'h'>): string {
    const radius = w / 2;
    const springLine = y + radius;

    return `M${x} ${y + h} V${springLine} A${radius} ${radius} 0 0 1 ${x + w} ${springLine} V${y + h} Z`;
}

/** Polaroid border around a slot: 5% of the slot width on three sides, 19% below. */
export function polaroidBox(slot: LayoutSlot): { x: number; y: number; w: number; h: number } {
    const pad = slot.w * 0.05;
    const bottom = slot.w * 0.19;

    return { x: slot.x - pad, y: slot.y - pad, w: slot.w + pad * 2, h: slot.h + pad + bottom };
}

export function shotsLabel(count: number): string {
    return count === 1 ? '1 photo' : `${count} photos`;
}

/** Footer proportions (fractions of the footer height), shared by the composer and the preview. */
export interface FooterMetrics {
    ornamentY: number;
    nameSize: number;
    nameY: number;
    dateSize: number;
    dateY: number;
    tagSize: number;
    tagY: number;
}

/**
 * Landscape frames have a shallow footer band, so their names and date are set
 * larger within it to read at the same size as on portrait frames.
 */
export function footerMetrics(layout: Pick<Layout, 'canvas'>): FooterMetrics {
    if (layout.canvas.w > layout.canvas.h) {
        return { ornamentY: 0.12, nameSize: 0.32, nameY: 0.52, dateSize: 0.095, dateY: 0.76, tagSize: 0.085, tagY: 0.93 };
    }

    return { ornamentY: 0.16, nameSize: 0.24, nameY: 0.48, dateSize: 0.075, dateY: 0.68, tagSize: 0.07, tagY: 0.85 };
}
