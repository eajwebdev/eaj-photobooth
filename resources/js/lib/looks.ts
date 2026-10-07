import type { LookSlug } from '@/types';
import type { CSSProperties } from 'react';

/**
 * A 4×5 colour matrix in feColorMatrix order, 0–255 offsets in column 5:
 *   R' = m0·R + m1·G + m2·B + m3·A + m4   (and likewise for G', B', A')
 */
export type ColorMatrix = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
];

/** One step of a look, using the CSS filter function of the same name. */
export type LookOp =
    | { op: 'saturate'; amount: number }
    | { op: 'sepia'; amount: number }
    | { op: 'grayscale'; amount: number }
    | { op: 'contrast'; amount: number }
    | { op: 'brightness'; amount: number }
    /** A colour cast added on top (0–255 per channel). Not a CSS function: shown live as a tint layer. */
    | { op: 'tint'; r: number; g: number; b: number };

export interface Look {
    slug: LookSlug;
    name: string;
    description: string;
    ops: LookOp[];
    /** Edge darkening, 0–1. */
    vignette: number;
    /** CSS filter for the live preview, built from the same ops as the saved matrix. */
    cssFilter: string;
    /** Live approximation of the tint op. */
    overlay?: CSSProperties;
    /** The exact matrix applied to the saved photo's pixels. */
    matrix: ColorMatrix;
}

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

// Matrices from the W3C Filter Effects spec, so they match the browser's CSS filters.
function opMatrix(step: LookOp): ColorMatrix {
    switch (step.op) {
        case 'saturate': {
            const s = step.amount;

            return [
                0.213 + 0.787 * s,
                0.715 - 0.715 * s,
                0.072 - 0.072 * s,
                0,
                0,
                0.213 - 0.213 * s,
                0.715 + 0.285 * s,
                0.072 - 0.072 * s,
                0,
                0,
                0.213 - 0.213 * s,
                0.715 - 0.715 * s,
                0.072 + 0.928 * s,
                0,
                0,
                0,
                0,
                0,
                1,
                0,
            ];
        }
        case 'sepia': {
            const a = 1 - Math.min(1, step.amount);

            return [
                0.393 + 0.607 * a,
                0.769 - 0.769 * a,
                0.189 - 0.189 * a,
                0,
                0,
                0.349 - 0.349 * a,
                0.686 + 0.314 * a,
                0.168 - 0.168 * a,
                0,
                0,
                0.272 - 0.272 * a,
                0.534 - 0.534 * a,
                0.131 + 0.869 * a,
                0,
                0,
                0,
                0,
                0,
                1,
                0,
            ];
        }
        case 'grayscale': {
            const a = 1 - Math.min(1, step.amount);

            return [
                0.2126 + 0.7874 * a,
                0.7152 - 0.7152 * a,
                0.0722 - 0.0722 * a,
                0,
                0,
                0.2126 - 0.2126 * a,
                0.7152 + 0.2848 * a,
                0.0722 - 0.0722 * a,
                0,
                0,
                0.2126 - 0.2126 * a,
                0.7152 - 0.7152 * a,
                0.0722 + 0.9278 * a,
                0,
                0,
                0,
                0,
                0,
                1,
                0,
            ];
        }
        case 'contrast': {
            const c = step.amount;
            const offset = (0.5 - 0.5 * c) * 255;

            return [c, 0, 0, 0, offset, 0, c, 0, 0, offset, 0, 0, c, 0, offset, 0, 0, 0, 1, 0];
        }
        case 'brightness': {
            const b = step.amount;

            return [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
        }
        case 'tint':
            return [1, 0, 0, 0, step.r, 0, 1, 0, 0, step.g, 0, 0, 1, 0, step.b, 0, 0, 0, 1, 0];
    }
}

/** `after ∘ before`: the matrix that applies `before` first, then `after`. */
export function multiplyMatrices(after: ColorMatrix, before: ColorMatrix): ColorMatrix {
    const result = new Array<number>(20).fill(0);

    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
            let sum = col === 4 ? after[row * 5 + 4] : 0;

            for (let k = 0; k < 4; k++) {
                sum += after[row * 5 + k] * before[k * 5 + col];
            }

            result[row * 5 + col] = sum;
        }
    }

    return result as ColorMatrix;
}

/** Composes ops left to right, exactly like a CSS filter list. */
export function matrixFor(ops: LookOp[]): ColorMatrix {
    return ops.reduce<ColorMatrix>((current, step) => multiplyMatrices(opMatrix(step), current), IDENTITY);
}

function cssFilterFor(ops: LookOp[]): string {
    return ops
        .filter((step): step is Exclude<LookOp, { op: 'tint' }> => step.op !== 'tint')
        .map((step) => `${step.op}(${step.amount})`)
        .join(' ');
}

function tintOverlay(ops: LookOp[]): CSSProperties | undefined {
    const tint = ops.find((step): step is Extract<LookOp, { op: 'tint' }> => step.op === 'tint');

    if (!tint) {
        return undefined;
    }

    const strength = Math.min(0.35, (Math.abs(tint.r) + Math.abs(tint.g) + Math.abs(tint.b)) / 120);
    const channel = (value: number) => Math.round(128 + Math.sign(value) * Math.min(127, Math.abs(value) * 6));

    return { backgroundColor: `rgb(${channel(tint.r)} ${channel(tint.g)} ${channel(tint.b)} / ${strength})`, mixBlendMode: 'soft-light' };
}

function defineLook(slug: LookSlug, name: string, description: string, ops: LookOp[], vignette: number): Look {
    return { slug, name, description, ops, vignette, cssFilter: cssFilterFor(ops), overlay: tintOverlay(ops), matrix: matrixFor(ops) };
}

/**
 * The four wedding looks. The live preview uses the CSS filters; the saved
 * photo applies the identical colour matrix to its pixels, because ctx.filter
 * is unreliable on Safari.
 */
export const LOOKS: Record<LookSlug, Look> = {
    classic: defineLook(
        'classic',
        'Classic',
        'Natural, a little warm',
        [
            { op: 'saturate', amount: 1.06 },
            { op: 'contrast', amount: 1.04 },
            { op: 'sepia', amount: 0.06 },
        ],
        0,
    ),
    ivory: defineLook(
        'ivory',
        'Ivory',
        'Soft and warm, with a gentle glow',
        [
            { op: 'sepia', amount: 0.2 },
            { op: 'saturate', amount: 0.9 },
            { op: 'brightness', amount: 1.07 },
            { op: 'contrast', amount: 0.88 },
            { op: 'tint', r: 8, g: 4, b: -2 },
        ],
        0.18,
    ),
    noir: defineLook(
        'noir',
        'Noir',
        'Rich black and white',
        [
            { op: 'grayscale', amount: 1 },
            { op: 'contrast', amount: 1.28 },
            { op: 'brightness', amount: 1.02 },
        ],
        0.3,
    ),
    royal: defineLook(
        'royal',
        'Royal',
        'Cool, softly faded, blue shadows',
        [
            { op: 'saturate', amount: 0.82 },
            { op: 'contrast', amount: 0.92 },
            { op: 'brightness', amount: 1.04 },
            { op: 'tint', r: -4, g: 0, b: 12 },
        ],
        0.15,
    ),
};

export function lookFor(slug: LookSlug | null | undefined): Look {
    return (slug && LOOKS[slug]) || LOOKS.classic;
}

/**
 * Applies a look to RGBA pixels in place: the colour matrix, then the same
 * vignette as the preview (black fading in from 55% of the way to the corners).
 * `fromRow`/`toRow` let callers work in chunks to keep the screen responsive.
 */
export function applyLookToPixels(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    look: Pick<Look, 'matrix' | 'vignette'>,
    fromRow = 0,
    toRow = height,
): void {
    const m = look.matrix;
    const cx = width / 2;
    const cy = height / 2;

    for (let y = fromRow; y < toRow; y++) {
        const dy = (y + 0.5 - cy) / cy;

        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            let shade = 1;

            if (look.vignette > 0) {
                const dx = (x + 0.5 - cx) / cx;
                const distance = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
                const t = Math.min(1, Math.max(0, (distance - 0.55) / 0.45));
                shade = 1 - look.vignette * t;
            }

            data[i] = (m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]) * shade;
            data[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]) * shade;
            data[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]) * shade;
        }
    }
}
