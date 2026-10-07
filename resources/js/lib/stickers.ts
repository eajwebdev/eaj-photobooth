/**
 * The sticker set: gold line art with royal-blue fills, drawn as vectors on a
 * canvas at whatever size they are placed, so they stay crisp at full print
 * resolution.
 */

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface StickerDefinition {
    id: string;
    label: string;
    /** width ÷ height */
    aspect: number;
    draw: (ctx: Canvas2D, w: number, h: number) => void;
}

/** A sticker placed on a collage. Position and size are fractions of the collage. */
export interface StickerPlacement {
    key: string;
    id: string;
    /** Centre, 0–1 across the collage. */
    x: number;
    y: number;
    /** Width as a fraction of the collage width. */
    width: number;
    /** Radians. */
    rotation: number;
}

const GOLD = '#C9A14A';
const GOLD_LIGHT = '#E8D29B';
const GOLD_DEEP = '#A07C2C';
const ROYAL = '#1F3F95';
const NAVY = '#0C1C45';
const WHITE = '#FFFFFF';
const DISPLAY = '"Bodoni Moda", Georgia, serif';

// ----------------------------------------------------------------- helpers

function goldGradient(ctx: Canvas2D, h: number): CanvasGradient {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#E2C27A');
    gradient.addColorStop(0.55, GOLD);
    gradient.addColorStop(1, GOLD_DEEP);

    return gradient;
}

function fitText(ctx: Canvas2D, text: string, family: string, maxWidth: number, start: number, italic = true, weight = 400): number {
    let size = start;

    do {
        ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
        size *= 0.94;
    } while (ctx.measureText(text).width > maxWidth && size > 6);

    return size / 0.94;
}

function centredText(ctx: Canvas2D, text: string, cx: number, cy: number, maxWidth: number, size: number, colour: string, family = DISPLAY, italic = true, weight = 400): void {
    fitText(ctx, text, family, maxWidth, size, italic, weight);
    ctx.fillStyle = colour;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
}

function roundedRect(ctx: Canvas2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function heartPath(ctx: Canvas2D, cx: number, cy: number, size: number): void {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.7, cy - s * 1.3, cx, cy - s * 0.45);
    ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.3, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9);
    ctx.closePath();
}

function sparkle(ctx: Canvas2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx, cy, cx + r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + r);
    ctx.quadraticCurveTo(cx, cy, cx - r, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - r);
    ctx.closePath();
    ctx.fill();
}

/** A royal pill with a double gold rule and a word in Bodoni italic. */
function pillBadge(text: string): StickerDefinition['draw'] {
    return (ctx, w, h) => {
        const line = Math.max(1.5, h * 0.05);
        roundedRect(ctx, line, line, w - line * 2, h - line * 2, (h - line * 2) / 2);
        ctx.fillStyle = ROYAL;
        ctx.fill();
        ctx.lineWidth = line;
        ctx.strokeStyle = goldGradient(ctx, h);
        ctx.stroke();
        roundedRect(ctx, line * 3.2, line * 3.2, w - line * 6.4, h - line * 6.4, (h - line * 6.4) / 2);
        ctx.lineWidth = line * 0.45;
        ctx.strokeStyle = GOLD_LIGHT;
        ctx.stroke();
        centredText(ctx, text, w / 2, h * 0.54, w * 0.78, h * 0.5, WHITE);
    };
}

/** A white speech bubble with a gold outline. */
function speechBubble(text: string): StickerDefinition['draw'] {
    return (ctx, w, h) => {
        const line = Math.max(1.5, h * 0.035);
        const bodyH = h * 0.78;
        ctx.beginPath();
        ctx.ellipse(w / 2, bodyH / 2 + line, w / 2 - line, bodyH / 2 - line, 0, 0, Math.PI * 2);
        ctx.moveTo(w * 0.3, bodyH * 0.86);
        ctx.lineTo(w * 0.2, h - line);
        ctx.lineTo(w * 0.42, bodyH * 0.93);
        ctx.fillStyle = WHITE;
        ctx.fill();
        ctx.lineWidth = line;
        ctx.strokeStyle = GOLD;
        ctx.stroke();
        centredText(ctx, text, w / 2, bodyH / 2 + line, w * 0.72, bodyH * 0.38, NAVY);
    };
}

/** A ribbon banner with folded ends. */
function ribbon(text: string): StickerDefinition['draw'] {
    return (ctx, w, h) => {
        const fold = w * 0.08;
        const top = h * 0.12;
        const bottom = h * 0.88;
        ctx.fillStyle = GOLD_DEEP;
        for (const side of [0, 1]) {
            ctx.beginPath();
            const x = side === 0 ? 0 : w;
            const dir = side === 0 ? 1 : -1;
            ctx.moveTo(x, top + h * 0.12);
            ctx.lineTo(x + dir * fold * 1.6, top + h * 0.12);
            ctx.lineTo(x + dir * fold * 1.6, bottom + h * 0.08);
            ctx.lineTo(x, bottom + h * 0.08);
            ctx.lineTo(x + dir * fold * 0.7, (top + bottom) / 2 + h * 0.1);
            ctx.closePath();
            ctx.fill();
        }
        roundedRect(ctx, fold, top, w - fold * 2, bottom - top, h * 0.06);
        ctx.fillStyle = goldGradient(ctx, h);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = Math.max(1, h * 0.025);
        ctx.strokeRect(fold * 1.4, top + h * 0.08, w - fold * 2.8, bottom - top - h * 0.16);
        centredText(ctx, text, w / 2, (top + bottom) / 2 + h * 0.02, w * 0.72, h * 0.42, NAVY);
    };
}

// ------------------------------------------------------------------- icons

const drawCrown: StickerDefinition['draw'] = (ctx, w, h) => {
    const line = Math.max(1.5, w * 0.035);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.85);
    ctx.lineTo(w * 0.06, h * 0.3);
    ctx.lineTo(w * 0.3, h * 0.55);
    ctx.lineTo(w * 0.5, h * 0.12);
    ctx.lineTo(w * 0.7, h * 0.55);
    ctx.lineTo(w * 0.94, h * 0.3);
    ctx.lineTo(w * 0.9, h * 0.85);
    ctx.closePath();
    ctx.fillStyle = goldGradient(ctx, h);
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = GOLD_DEEP;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = ROYAL;
    for (const [x, y] of [[0.06, 0.3], [0.5, 0.12], [0.94, 0.3]]) {
        ctx.beginPath();
        ctx.arc(w * x, h * y, w * 0.05, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = WHITE;
    ctx.fillRect(w * 0.14, h * 0.72, w * 0.72, h * 0.05);
};

const drawVeil: StickerDefinition['draw'] = (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.06);
    ctx.bezierCurveTo(w * 0.05, h * 0.2, w * 0.02, h * 0.75, w * 0.12, h * 0.95);
    ctx.lineTo(w * 0.88, h * 0.95);
    ctx.bezierCurveTo(w * 0.98, h * 0.75, w * 0.95, h * 0.2, w * 0.5, h * 0.06);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, w * 0.025);
    ctx.strokeStyle = GOLD;
    ctx.stroke();
    ctx.fillStyle = GOLD_LIGHT;
    for (let i = 0; i < 9; i++) {
        sparkle(ctx, w * (0.25 + (i % 3) * 0.25), h * (0.35 + Math.floor(i / 3) * 0.18), w * 0.022);
    }
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.08, w * 0.16, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = goldGradient(ctx, h * 0.2);
    ctx.fill();
};

const drawBowTie: StickerDefinition['draw'] = (ctx, w, h) => {
    ctx.fillStyle = NAVY;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.5, h * 0.05);
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(w / 2 + side * w * 0.46, h * 0.1);
        ctx.quadraticCurveTo(w / 2 + side * w * 0.5, h / 2, w / 2 + side * w * 0.46, h * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    roundedRect(ctx, w * 0.42, h * 0.3, w * 0.16, h * 0.4, h * 0.08);
    ctx.fillStyle = goldGradient(ctx, h);
    ctx.fill();
};

const drawHeartFrame: StickerDefinition['draw'] = (ctx, w, h) => {
    const size = Math.min(w, h);
    ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.strokeStyle = goldGradient(ctx, h);
    heartPath(ctx, w / 2, h * 0.52, size * 0.92);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, size * 0.015);
    ctx.strokeStyle = GOLD_LIGHT;
    heartPath(ctx, w / 2, h * 0.52, size * 0.8);
    ctx.stroke();
    ctx.fillStyle = GOLD_LIGHT;
    sparkle(ctx, w * 0.82, h * 0.18, size * 0.06);
    sparkle(ctx, w * 0.16, h * 0.78, size * 0.045);
};

const drawChampagne: StickerDefinition['draw'] = (ctx, w, h) => {
    const line = Math.max(1.5, w * 0.03);
    for (const [cx, tilt] of [[0.36, -0.22], [0.64, 0.22]] as const) {
        ctx.save();
        ctx.translate(w * cx, h * 0.92);
        ctx.rotate(tilt);
        ctx.beginPath();
        ctx.moveTo(-w * 0.1, -h * 0.82);
        ctx.lineTo(w * 0.1, -h * 0.82);
        ctx.lineTo(w * 0.06, -h * 0.42);
        ctx.quadraticCurveTo(0, -h * 0.36, -w * 0.06, -h * 0.42);
        ctx.closePath();
        ctx.fillStyle = 'rgba(232,210,155,0.55)';
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = line;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.38);
        ctx.lineTo(0, -h * 0.04);
        ctx.moveTo(-w * 0.08, 0);
        ctx.lineTo(w * 0.08, 0);
        ctx.stroke();
        ctx.restore();
    }
    ctx.fillStyle = GOLD_LIGHT;
    sparkle(ctx, w * 0.5, h * 0.1, w * 0.07);
    sparkle(ctx, w * 0.32, h * 0.04, w * 0.035);
    sparkle(ctx, w * 0.7, h * 0.06, w * 0.04);
};

const drawRings: StickerDefinition['draw'] = (ctx, w, h) => {
    ctx.lineWidth = Math.max(2, w * 0.06);
    ctx.strokeStyle = goldGradient(ctx, h);
    ctx.beginPath();
    ctx.ellipse(w * 0.38, h * 0.6, w * 0.26, h * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.6, w * 0.26, h * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.12);
    ctx.lineTo(w * 0.7, h * 0.2);
    ctx.lineTo(w * 0.62, h * 0.31);
    ctx.lineTo(w * 0.54, h * 0.2);
    ctx.closePath();
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.015);
    ctx.strokeStyle = GOLD_DEEP;
    ctx.stroke();
};

const drawDoves: StickerDefinition['draw'] = (ctx, w, h) => {
    const dove = (cx: number, cy: number, s: number, flip: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(flip, 1);
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.25, s * 0.35, -s * 0.12);
        ctx.quadraticCurveTo(s * 0.55, -s * 0.2, s * 0.5, -s * 0.02);
        ctx.quadraticCurveTo(s * 0.2, s * 0.25, -s * 0.5, 0);
        ctx.moveTo(-s * 0.1, -s * 0.08);
        ctx.quadraticCurveTo(-s * 0.15, -s * 0.7, s * 0.15, -s * 0.55);
        ctx.quadraticCurveTo(s * 0.05, -s * 0.3, s * 0.1, -s * 0.12);
        ctx.fillStyle = WHITE;
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = Math.max(1.2, s * 0.04);
        ctx.stroke();
        ctx.restore();
    };
    dove(w * 0.33, h * 0.62, w * 0.5, 1);
    dove(w * 0.67, h * 0.5, w * 0.5, -1);
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.strokeStyle = GOLD;
    heartPath(ctx, w * 0.5, h * 0.22, w * 0.16);
    ctx.stroke();
};

const drawSparkles: StickerDefinition['draw'] = (ctx, w, h) => {
    ctx.fillStyle = goldGradient(ctx, h);
    sparkle(ctx, w * 0.42, h * 0.45, w * 0.36);
    ctx.fillStyle = GOLD_LIGHT;
    sparkle(ctx, w * 0.8, h * 0.2, w * 0.14);
    sparkle(ctx, w * 0.78, h * 0.78, w * 0.1);
    sparkle(ctx, w * 0.12, h * 0.85, w * 0.07);
};

const drawMabuhay: StickerDefinition['draw'] = (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const points = 16;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? w * 0.48 : w * 0.4;
        const angle = (i / (points * 2)) * Math.PI * 2;
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fillStyle = goldGradient(ctx, h);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = ROYAL;
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.strokeStyle = GOLD_LIGHT;
    ctx.stroke();
    centredText(ctx, 'Mabuhay!', cx, cy, w * 0.56, w * 0.2, WHITE);
};

const drawMrMrs: StickerDefinition['draw'] = (ctx, w, h) => {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.lineWidth = Math.max(2, h * 0.045);
    ctx.strokeStyle = goldGradient(ctx, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2 - h * 0.12, h / 2 - h * 0.12, 0, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, h * 0.015);
    ctx.strokeStyle = GOLD;
    ctx.stroke();
    centredText(ctx, 'Mr & Mrs', w / 2, h / 2 + h * 0.02, w * 0.72, h * 0.34, NAVY);
};

// ------------------------------------------------------------------ the set

export const STICKERS: StickerDefinition[] = [
    { id: 'just-married', label: 'Just married', aspect: 3.4, draw: ribbon('Just married') },
    { id: 'mr-mrs', label: 'Mr & Mrs', aspect: 1.7, draw: drawMrMrs },
    { id: 'crown', label: 'Crown', aspect: 1.3, draw: drawCrown },
    { id: 'veil', label: 'Veil', aspect: 0.8, draw: drawVeil },
    { id: 'bow-tie', label: 'Bow tie', aspect: 2, draw: drawBowTie },
    { id: 'heart-frame', label: 'Heart frame', aspect: 1.05, draw: drawHeartFrame },
    { id: 'champagne', label: 'Champagne glasses', aspect: 0.9, draw: drawChampagne },
    { id: 'rings', label: 'Rings', aspect: 1.25, draw: drawRings },
    { id: 'doves', label: 'Doves', aspect: 1.3, draw: drawDoves },
    { id: 'sparkles', label: 'Sparkles', aspect: 1, draw: drawSparkles },
    { id: 'i-do', label: 'I do!', aspect: 1.35, draw: speechBubble('I do!') },
    { id: 'kilig', label: 'Kilig!', aspect: 1.35, draw: speechBubble('Kilig!') },
    { id: 'forever', label: "Forever na 'to", aspect: 1.6, draw: speechBubble("Forever na 'to") },
    { id: 'mabuhay', label: 'Mabuhay!', aspect: 1, draw: drawMabuhay },
    { id: 'best-day', label: 'Best day ever', aspect: 3.4, draw: ribbon('Best day ever') },
    { id: 'ninong', label: 'Ninong', aspect: 2.6, draw: pillBadge('Ninong') },
    { id: 'ninang', label: 'Ninang', aspect: 2.6, draw: pillBadge('Ninang') },
    { id: 'abay', label: 'Abay', aspect: 2.3, draw: pillBadge('Abay') },
    { id: 'team-groom', label: 'Team Groom', aspect: 3.2, draw: pillBadge('Team Groom') },
    { id: 'team-bride', label: 'Team Bride', aspect: 3.2, draw: pillBadge('Team Bride') },
    { id: 'barkada', label: 'Barkada', aspect: 2.8, draw: pillBadge('Barkada') },
    { id: 'lola', label: 'Lola', aspect: 2.3, draw: pillBadge('Lola') },
    { id: 'tito', label: 'Tito', aspect: 2.3, draw: pillBadge('Tito') },
    { id: 'tita', label: 'Tita', aspect: 2.3, draw: pillBadge('Tita') },
];

export function stickerById(id: string): StickerDefinition | undefined {
    return STICKERS.find((sticker) => sticker.id === id);
}

/** Draws one placed sticker onto a canvas of the given size (vector, full resolution). */
export function drawPlacement(ctx: Canvas2D, placement: StickerPlacement, canvasW: number, canvasH: number): void {
    const definition = stickerById(placement.id);

    if (!definition) {
        return;
    }

    const w = placement.width * canvasW;
    const h = w / definition.aspect;

    ctx.save();
    ctx.translate(placement.x * canvasW, placement.y * canvasH);
    ctx.rotate(placement.rotation);
    ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = Math.max(2, w * 0.03);
    ctx.shadowOffsetY = Math.max(1, w * 0.012);
    definition.draw(ctx, w, h);
    ctx.restore();
}

/** The finished collage with its stickers painted in at full size (JPEG 0.92). */
export async function applyStickers(collage: Blob, placements: StickerPlacement[]): Promise<Blob> {
    if (placements.length === 0) {
        return collage;
    }

    const bitmap = await createImageBitmap(collage);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    placements.forEach((placement) => drawPlacement(ctx, placement, canvas.width, canvas.height));

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => {
                canvas.width = 0;

                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('The stickers could not be added.'));
                }
            },
            'image/jpeg',
            0.92,
        ),
    );
}

/** A small picture of a sticker for the tray and the editor (data URL). */
export function stickerImage(definition: StickerDefinition, width = 360): string {
    const height = Math.round(width / definition.aspect);
    const canvas = document.createElement('canvas');
    const pad = Math.round(width * 0.06);
    canvas.width = width + pad * 2;
    canvas.height = height + pad * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(pad, pad);
    definition.draw(ctx, width, height);
    const url = canvas.toDataURL('image/png');
    canvas.width = 0;

    return url;
}
