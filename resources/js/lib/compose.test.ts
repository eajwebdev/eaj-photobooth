import { describe, expect, it } from 'vitest';
import rawLayouts from '../../../database/data/layouts.json';
import { coverSource, fitFontSize, frameScale, layoutWish, wrapWords } from './compose';
import { polaroidBox, type Layout } from './layouts';

const layouts = rawLayouts as unknown as Layout[];

describe('coverSource', () => {
    it('crops the sides of a wide photo to fill a portrait slot', () => {
        expect(coverSource({ w: 1600, h: 1200 }, { w: 600, h: 600 })).toEqual({ x: 200, y: 0, w: 1200, h: 1200 });
    });

    it('crops top and bottom of a tall photo to fill a wide slot', () => {
        expect(coverSource({ w: 1200, h: 1600 }, { w: 825, h: 880 * 0.5 })).toMatchObject({ x: 0, w: 1200 });
    });
});

describe('layouts.json', () => {
    it('has 20 frames', () => {
        expect(layouts).toHaveLength(20);
    });

    it.each(layouts.map((layout) => [layout.slug, layout] as const))('%s keeps every slot inside the canvas', (_, layout) => {
        for (const slot of layout.slots) {
            const box = layout.style === 'polaroid' ? polaroidBox(slot) : slot;

            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.w).toBeLessThanOrEqual(layout.canvas.w);
            expect(box.y + box.h).toBeLessThanOrEqual(layout.canvas.h);
        }
    });

    it.each(layouts.filter((layout) => layout.style !== 'magazine').map((layout) => [layout.slug, layout] as const))(
        '%s keeps photos clear of the footer',
        (_, layout) => {
            for (const slot of layout.slots) {
                expect(slot.y + slot.h).toBeLessThanOrEqual(layout.footer.y);
            }
        },
    );

    it('scales frame lines by the shorter canvas side', () => {
        const strip = layouts.find((layout) => layout.slug === 'photo-strip-3')!;

        expect(frameScale(strip)).toBe(0.5);
    });
});

describe('text fitting', () => {
    const measure = (text: string, size: number) => text.length * size * 0.5;

    it('shrinks a font until the line fits', () => {
        const size = fitFontSize((s) => measure('Edwin & Jochel', s), 300, 100, 10);

        expect(measure('Edwin & Jochel', size)).toBeLessThanOrEqual(300);
        expect(size).toBeGreaterThan((300 / (14 * 0.5)) * 0.9);
    });

    it('wraps words without breaking them', () => {
        expect(wrapWords('may your love grow every day', (line) => line.length, 12)).toEqual(['may your', 'love grow', 'every day']);
    });

    it('fits a long wish in at most four lines', () => {
        const wish = 'Congratulations to you both, may your home be full of laughter, music, good food and many grandchildren for Lola';
        const result = layoutWish(wish, measure, { w: 900, h: 380 });

        expect(result.lines.length).toBeLessThanOrEqual(4);
        result.lines.forEach((line) => expect(measure(line, result.size)).toBeLessThanOrEqual(900));
    });
});
