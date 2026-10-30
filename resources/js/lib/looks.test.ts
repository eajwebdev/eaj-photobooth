import { describe, expect, it } from 'vitest';
import { applyLookToPixels, LOOK_SLUGS, LOOKS, matrixFor } from './looks';

function pixel(r: number, g: number, b: number): Uint8ClampedArray {
    return new Uint8ClampedArray([r, g, b, 255]);
}

function apply(data: Uint8ClampedArray, matrix: ReturnType<typeof matrixFor>): number[] {
    applyLookToPixels(data, 1, 1, { matrix, vignette: 0 });

    return Array.from(data);
}

describe('look matrices', () => {
    it('turns pure red into the Noir grey (grayscale → contrast 1.28 → brightness 1.02)', () => {
        // 0.2126 × 255 = 54.21 → 1.28 × 54.21 − 0.14 × 255 = 33.69 → × 1.02 = 34.37
        expect(apply(pixel(255, 0, 0), LOOKS.noir.matrix)).toEqual([34, 34, 34, 255]);
    });

    it('keeps white white under brightness 1 and contrast 1', () => {
        expect(
            apply(
                pixel(255, 255, 255),
                matrixFor([
                    { op: 'contrast', amount: 1 },
                    { op: 'brightness', amount: 1 },
                ]),
            ),
        ).toEqual([255, 255, 255, 255]);
    });

    it('applies a contrast below 1 by lifting blacks', () => {
        // 0.88 × 0 + (0.5 − 0.44) × 255 = 15.3
        expect(apply(pixel(0, 0, 0), matrixFor([{ op: 'contrast', amount: 0.88 }]))).toEqual([15, 15, 15, 255]);
    });

    it('adds the tint after the other steps', () => {
        expect(
            apply(
                pixel(100, 100, 100),
                matrixFor([
                    { op: 'brightness', amount: 2 },
                    { op: 'tint', r: -4, g: 0, b: 12 },
                ]),
            ),
        ).toEqual([196, 200, 212, 255]);
    });

    it('gives Royal cooler mid-tones than Classic', () => {
        const [r, , b] = apply(pixel(128, 128, 128), LOOKS.royal.matrix);

        expect(b).toBeGreaterThan(r);
    });

    it('builds each preview CSS filter from the same steps as its matrix', () => {
        expect(LOOKS.noir.cssFilter).toBe('grayscale(1) contrast(1.28) brightness(1.02)');
        expect(LOOKS.royal.cssFilter).toBe('saturate(0.82) contrast(0.92) brightness(1.04)');
    });
});

describe('vignette', () => {
    it('darkens the corners but leaves the centre untouched', () => {
        const size = 21;
        const data = new Uint8ClampedArray(size * size * 4).fill(200);
        applyLookToPixels(data, size, size, { matrix: matrixFor([]), vignette: 0.3 });

        const at = (x: number, y: number) => data[(y * size + x) * 4];

        expect(at(10, 10)).toBe(200);
        expect(at(0, 0)).toBeLessThan(150);
    });
});

describe('the look list', () => {
    it('offers at least ten looks, with a vintage set', () => {
        expect(LOOK_SLUGS.length).toBeGreaterThanOrEqual(10);
        expect(LOOK_SLUGS.filter((slug) => LOOKS[slug].group === 'vintage').length).toBeGreaterThanOrEqual(4);
    });

    it('keeps fade out of the CSS filter (it is shown as a layer instead)', () => {
        expect(LOOKS.silver.cssFilter).toBe('grayscale(1) contrast(0.95)');
        expect(LOOKS.silver.overlays.some((layer) => layer.mixBlendMode === 'lighten')).toBe(true);
    });
});

describe('fade', () => {
    it('lifts black to grey but keeps white white', () => {
        const fade = matrixFor([{ op: 'fade', amount: 0.1 }]);

        expect(apply(pixel(0, 0, 0), fade)).toEqual([26, 26, 26, 255]);
        expect(apply(pixel(255, 255, 255), fade)).toEqual([255, 255, 255, 255]);
    });
});

describe('light leak', () => {
    it('brightens towards its corner and leaves the far corner untouched', () => {
        const size = 20;
        const data = new Uint8ClampedArray(size * size * 4).fill(100);
        applyLookToPixels(data, size, size, {
            matrix: matrixFor([]),
            vignette: 0,
            leak: { x: 1, y: 0, radius: 0.5, r: 255, g: 120, b: 60, strength: 0.5 },
        });

        const at = (x: number, y: number) => Array.from(data.slice((y * size + x) * 4, (y * size + x) * 4 + 3));

        expect(at(19, 0)[0]).toBeGreaterThan(140);
        expect(at(0, 19)).toEqual([100, 100, 100]);
    });
});

describe('grain', () => {
    const grainy = (seed: number) => {
        const data = new Uint8ClampedArray(16 * 16 * 4).fill(128);
        applyLookToPixels(data, 16, 16, { matrix: matrixFor([]), vignette: 0, grain: 0.5 }, 0, 16, seed);

        return Array.from(data);
    };

    it('is the same every time for the same photo', () => {
        expect(grainy(0)).toEqual(grainy(0));
    });

    it('changes with the seed, so boomerang frames flicker like film', () => {
        expect(grainy(1)).not.toEqual(grainy(0));
    });

    it('stays subtle', () => {
        expect(Math.max(...grainy(0).map((value) => Math.abs(value - 128)))).toBeLessThanOrEqual(22);
    });
});
