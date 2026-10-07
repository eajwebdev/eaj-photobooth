import { describe, expect, it } from 'vitest';
import { applyLookToPixels, LOOKS, matrixFor } from './looks';

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
