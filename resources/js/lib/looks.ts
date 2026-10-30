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
    /** Lifts the blacks towards grey (0–1) while keeping whites white: the washed-out print look. Shown live as a lighten layer. */
    | { op: 'fade'; amount: number }
    /** A colour cast added on top (0–255 per channel). Not a CSS function: shown live as a tint layer. */
    | { op: 'tint'; r: number; g: number; b: number };

/** How looks are grouped in the picker. */
export type LookGroup = 'natural' | 'vintage' | 'mono' | 'bold';

export const LOOK_GROUPS: Record<LookGroup, string> = {
    natural: 'Natural',
    vintage: 'Vintage',
    mono: 'Black & white',
    bold: 'Bold',
};

/** A warm glow from one edge, like light leaking into an old film camera. Screen-blended. */
export interface LightLeak {
    /** Centre of the glow, 0–1 across and down the photo. */
    x: number;
    y: number;
    /** Reach of the glow, as a fraction of the photo's diagonal. */
    radius: number;
    r: number;
    g: number;
    b: number;
    /** 0–1. */
    strength: number;
}

/** The finishing effects applied after the colour matrix. */
export interface LookEffects {
    /** Edge darkening, 0–1. */
    vignette: number;
    /** Film grain, 0–1. */
    grain?: number;
    leak?: LightLeak | null;
}

export interface Look extends LookEffects {
    slug: LookSlug;
    name: string;
    description: string;
    group: LookGroup;
    ops: LookOp[];
    /** CSS filter for the live preview, built from the same ops as the saved matrix. */
    cssFilter: string;
    /** Live approximations of the tint, fade, light leak and grain, layered over the preview. */
    overlays: CSSProperties[];
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
        case 'fade': {
            const amount = Math.min(1, step.amount);
            const scale = 1 - amount;
            const lift = amount * 255;

            return [scale, 0, 0, 0, lift, 0, scale, 0, 0, lift, 0, 0, scale, 0, lift, 0, 0, 0, 1, 0];
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

type CssOp = Exclude<LookOp, { op: 'tint' } | { op: 'fade' }>;

function cssFilterFor(ops: LookOp[]): string {
    return ops
        .filter((step): step is CssOp => step.op !== 'tint' && step.op !== 'fade')
        .map((step) => `${step.op}(${step.amount})`)
        .join(' ');
}

function tintOverlay(ops: LookOp[]): CSSProperties | null {
    const tint = ops.find((step): step is Extract<LookOp, { op: 'tint' }> => step.op === 'tint');

    if (!tint) {
        return null;
    }

    const strength = Math.min(0.35, (Math.abs(tint.r) + Math.abs(tint.g) + Math.abs(tint.b)) / 120);
    const channel = (value: number) => Math.round(128 + Math.sign(value) * Math.min(127, Math.abs(value) * 6));

    return { backgroundColor: `rgb(${channel(tint.r)} ${channel(tint.g)} ${channel(tint.b)} / ${strength})`, mixBlendMode: 'soft-light' };
}

/** "Lighten" with a flat grey raises every darker pixel to it: close to the fade op on the saved photo. */
function fadeOverlay(ops: LookOp[]): CSSProperties | null {
    const fade = ops.find((step): step is Extract<LookOp, { op: 'fade' }> => step.op === 'fade');

    if (!fade) {
        return null;
    }

    const lift = Math.round(Math.min(1, fade.amount) * 255);

    return { backgroundColor: `rgb(${lift} ${lift} ${lift})`, mixBlendMode: 'lighten' };
}

function leakOverlay(leak: LightLeak | null | undefined): CSSProperties | null {
    if (!leak) {
        return null;
    }

    // Stops are a share of the ray to the farthest corner: the full diagonal for a leak in a corner.
    const reach = Math.round(leak.radius * 100);

    return {
        background: `radial-gradient(circle at ${leak.x * 100}% ${leak.y * 100}%, rgb(${leak.r} ${leak.g} ${leak.b} / ${leak.strength}) 0%, transparent ${reach}%)`,
        mixBlendMode: 'screen',
    };
}

function vignetteOverlay(vignette: number): CSSProperties | null {
    return vignette > 0 ? { background: `radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / ${vignette}) 100%)` } : null;
}

const GRAIN_TEXTURE =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.6 -0.3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function grainOverlay(grain: number | undefined): CSSProperties | null {
    if (!grain) {
        return null;
    }

    return { backgroundImage: GRAIN_TEXTURE, backgroundSize: '160px 160px', mixBlendMode: 'overlay', opacity: Math.min(1, grain * 1.6) };
}

interface LookDefinition extends Partial<LookEffects> {
    name: string;
    description: string;
    group: LookGroup;
    ops: LookOp[];
}

function defineLook(slug: LookSlug, { name, description, group, ops, vignette = 0, grain = 0, leak = null }: LookDefinition): Look {
    return {
        slug,
        name,
        description,
        group,
        ops,
        vignette,
        grain,
        leak,
        cssFilter: cssFilterFor(ops),
        // Same order as the saved photo: colour, light leak, vignette, grain.
        overlays: [tintOverlay(ops), fadeOverlay(ops), leakOverlay(leak), vignetteOverlay(vignette), grainOverlay(grain)].filter(
            (layer): layer is CSSProperties => layer !== null,
        ),
        matrix: matrixFor(ops),
    };
}

/**
 * The looks. The live preview uses CSS filters and overlay layers; the saved
 * photo applies the identical colour matrix (plus light leak, vignette and
 * grain) to its pixels, because ctx.filter is unreliable on Safari.
 */
export const LOOKS: Record<LookSlug, Look> = {
    classic: defineLook('classic', {
        name: 'Classic',
        description: 'Natural, a little warm',
        group: 'natural',
        ops: [
            { op: 'saturate', amount: 1.06 },
            { op: 'contrast', amount: 1.04 },
            { op: 'sepia', amount: 0.06 },
        ],
    }),
    ivory: defineLook('ivory', {
        name: 'Ivory',
        description: 'Soft and warm, with a gentle glow',
        group: 'natural',
        ops: [
            { op: 'sepia', amount: 0.2 },
            { op: 'saturate', amount: 0.9 },
            { op: 'brightness', amount: 1.07 },
            { op: 'contrast', amount: 0.88 },
            { op: 'tint', r: 8, g: 4, b: -2 },
        ],
        vignette: 0.18,
    }),
    golden: defineLook('golden', {
        name: 'Golden hour',
        description: 'Sunset warmth on every face',
        group: 'natural',
        ops: [
            { op: 'sepia', amount: 0.14 },
            { op: 'saturate', amount: 1.12 },
            { op: 'brightness', amount: 1.05 },
            { op: 'tint', r: 16, g: 7, b: -8 },
        ],
        vignette: 0.12,
        leak: { x: 1, y: 0, radius: 0.7, r: 255, g: 176, b: 92, strength: 0.32 },
    }),
    blush: defineLook('blush', {
        name: 'Blush',
        description: 'Rosy, bright and soft',
        group: 'natural',
        ops: [
            { op: 'brightness', amount: 1.06 },
            { op: 'contrast', amount: 0.94 },
            { op: 'saturate', amount: 0.95 },
            { op: 'tint', r: 14, g: -2, b: 6 },
        ],
    }),
    royal: defineLook('royal', {
        name: 'Royal',
        description: 'Cool, softly faded, blue shadows',
        group: 'natural',
        ops: [
            { op: 'saturate', amount: 0.82 },
            { op: 'contrast', amount: 0.92 },
            { op: 'brightness', amount: 1.04 },
            { op: 'tint', r: -4, g: 0, b: 12 },
        ],
        vignette: 0.15,
    }),
    vintage: defineLook('vintage', {
        name: 'Vintage',
        description: 'Faded warm film with grain',
        group: 'vintage',
        ops: [
            { op: 'sepia', amount: 0.32 },
            { op: 'saturate', amount: 0.82 },
            { op: 'contrast', amount: 0.92 },
            { op: 'fade', amount: 0.1 },
            { op: 'tint', r: 10, g: 4, b: -8 },
        ],
        vignette: 0.35,
        grain: 0.35,
    }),
    instant: defineLook('instant', {
        name: 'Instant',
        description: 'An instant print with a light leak',
        group: 'vintage',
        ops: [
            { op: 'saturate', amount: 0.86 },
            { op: 'contrast', amount: 0.9 },
            { op: 'brightness', amount: 1.05 },
            { op: 'fade', amount: 0.12 },
            { op: 'tint', r: 4, g: 2, b: 6 },
        ],
        vignette: 0.15,
        grain: 0.2,
        leak: { x: 0.95, y: 0.1, radius: 0.55, r: 255, g: 122, b: 74, strength: 0.42 },
    }),
    seventies: defineLook('seventies', {
        name: '70s film',
        description: 'Orange, punchy and grainy',
        group: 'vintage',
        ops: [
            { op: 'sepia', amount: 0.24 },
            { op: 'saturate', amount: 1.25 },
            { op: 'contrast', amount: 1.05 },
            { op: 'fade', amount: 0.07 },
            { op: 'tint', r: 18, g: 4, b: -14 },
        ],
        vignette: 0.28,
        grain: 0.3,
        leak: { x: 0, y: 1, radius: 0.6, r: 255, g: 150, b: 60, strength: 0.28 },
    }),
    heirloom: defineLook('heirloom', {
        name: 'Heirloom',
        description: 'Sepia, like a family album',
        group: 'vintage',
        ops: [
            { op: 'sepia', amount: 0.85 },
            { op: 'contrast', amount: 1.05 },
            { op: 'fade', amount: 0.08 },
        ],
        vignette: 0.42,
        grain: 0.4,
    }),
    retro: defineLook('retro', {
        name: 'Retro',
        description: 'A cool 60s print, faded teal',
        group: 'vintage',
        ops: [
            { op: 'saturate', amount: 0.78 },
            { op: 'contrast', amount: 0.95 },
            { op: 'fade', amount: 0.12 },
            { op: 'tint', r: -10, g: 4, b: 10 },
        ],
        vignette: 0.2,
        grain: 0.25,
    }),
    noir: defineLook('noir', {
        name: 'Noir',
        description: 'Rich black and white',
        group: 'mono',
        ops: [
            { op: 'grayscale', amount: 1 },
            { op: 'contrast', amount: 1.28 },
            { op: 'brightness', amount: 1.02 },
        ],
        vignette: 0.3,
    }),
    silver: defineLook('silver', {
        name: 'Silver screen',
        description: 'Soft, grainy black and white',
        group: 'mono',
        ops: [
            { op: 'grayscale', amount: 1 },
            { op: 'contrast', amount: 0.95 },
            { op: 'fade', amount: 0.14 },
        ],
        vignette: 0.35,
        grain: 0.45,
    }),
    vivid: defineLook('vivid', {
        name: 'Vivid',
        description: 'Bright colour that pops',
        group: 'bold',
        ops: [
            { op: 'saturate', amount: 1.35 },
            { op: 'contrast', amount: 1.12 },
        ],
    }),
    lomo: defineLook('lomo', {
        name: 'Lomo',
        description: 'Deep colour, dark corners',
        group: 'bold',
        ops: [
            { op: 'saturate', amount: 1.3 },
            { op: 'contrast', amount: 1.25 },
            { op: 'tint', r: -4, g: 4, b: 8 },
        ],
        vignette: 0.55,
        grain: 0.15,
    }),
    dreamy: defineLook('dreamy', {
        name: 'Dreamy',
        description: 'Airy pastels and a pink glow',
        group: 'bold',
        ops: [
            { op: 'brightness', amount: 1.1 },
            { op: 'contrast', amount: 0.85 },
            { op: 'saturate', amount: 0.9 },
            { op: 'fade', amount: 0.08 },
            { op: 'tint', r: 6, g: 2, b: 10 },
        ],
        leak: { x: 0, y: 0, radius: 0.65, r: 255, g: 160, b: 200, strength: 0.3 },
    }),
    moody: defineLook('moody', {
        name: 'Moody',
        description: 'Dark, cool and cinematic',
        group: 'bold',
        ops: [
            { op: 'saturate', amount: 0.75 },
            { op: 'contrast', amount: 1.12 },
            { op: 'brightness', amount: 0.95 },
            { op: 'tint', r: -6, g: 0, b: 6 },
        ],
        vignette: 0.4,
    }),
};

/** Every look, in picker order. */
export const LOOK_SLUGS = Object.keys(LOOKS) as LookSlug[];

export function lookFor(slug: LookSlug | null | undefined): Look {
    return (slug && LOOKS[slug]) || LOOKS.classic;
}

/** A repeatable pseudo-random value in -1…1 for a pixel, so the grain is the same every time a photo is made. */
function noise(x: number, y: number, seed: number): number {
    let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed + 1, 1442695041);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    hash ^= hash >>> 16;

    return ((hash & 0xffff) / 0xffff) * 2 - 1;
}

/** Brightest grain speck at grain 1, in 0–255 levels. */
const GRAIN_LEVELS = 42;

/** Grain specks across the shorter side of a photo. */
const GRAIN_CELLS_ACROSS = 600;

/** Screen blend of one channel with a light of `light` (0–255): brightens, never darkens. */
function screen(value: number, light: number): number {
    const base = Math.min(255, Math.max(0, value));

    return 255 - ((255 - base) * (255 - light)) / 255;
}

/**
 * Applies a look to RGBA pixels in place: the colour matrix, the light leak,
 * the same vignette as the preview (black fading in from 55% of the way to the
 * corners), then film grain. `fromRow`/`toRow` let callers work in chunks to
 * keep the screen responsive; `seed` changes the grain (one per boomerang frame).
 */
export function applyLookToPixels(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    look: Pick<Look, 'matrix'> & LookEffects,
    fromRow = 0,
    toRow = height,
    seed = 0,
): void {
    const m = look.matrix;
    const cx = width / 2;
    const cy = height / 2;
    const grain = (look.grain ?? 0) * GRAIN_LEVELS;
    const leak = look.leak ?? null;
    const leakX = leak ? leak.x * width : 0;
    const leakY = leak ? leak.y * height : 0;
    const leakReach = leak ? leak.radius * Math.hypot(width, height) : 1;
    // Grain specks grow with the photo, so they read the same on a 700px boomerang frame and a 1600px shot.
    const grainCell = Math.max(1, Math.round(Math.min(width, height) / GRAIN_CELLS_ACROSS));

    for (let y = fromRow; y < toRow; y++) {
        const dy = (y + 0.5 - cy) / cy;

        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            let red = m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4];
            let green = m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9];
            let blue = m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14];

            if (leak) {
                const falloff = Math.max(0, 1 - Math.hypot(x - leakX, y - leakY) / leakReach);
                const weight = leak.strength * falloff * falloff;

                if (weight > 0) {
                    red = screen(red, leak.r * weight);
                    green = screen(green, leak.g * weight);
                    blue = screen(blue, leak.b * weight);
                }
            }

            let shade = 1;

            if (look.vignette > 0) {
                const dx = (x + 0.5 - cx) / cx;
                const distance = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
                const t = Math.min(1, Math.max(0, (distance - 0.55) / 0.45));
                shade = 1 - look.vignette * t;
            }

            const speck = grain > 0 ? noise(Math.floor(x / grainCell), Math.floor(y / grainCell), seed) * grain : 0;

            data[i] = red * shade + speck;
            data[i + 1] = green * shade + speck;
            data[i + 2] = blue * shade + speck;
        }
    }
}
