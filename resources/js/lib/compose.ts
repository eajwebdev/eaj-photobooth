import { applyLook } from '@/lib/apply-look';
import { centerCrop, type Rect, type Size } from '@/lib/capture-geometry';
import { footerMetrics, polaroidBox, type Layout, type LayoutSlot } from '@/lib/layouts';
import type { LookSlug } from '@/types';

/**
 * The collage composer: draws a frame from layouts.json at full print size
 * (e.g. 1200×1800 = 4×6 in at 300 DPI) following the Royal Chapel rendering
 * rules. Proportions match the SVG LayoutPreview so the miniature and the
 * saved image agree.
 */

export const COLLAGE_JPEG_QUALITY = 0.92;

const GOLD = '#C9A14A';
const GOLD_LIGHT = '#E8D29B';
const NAVY = '#0C1C45';
const ROYAL = '#1F3F95';
const MIST_PAPER = '#F6F7FB';
const INK_LIGHT = '#EEF2FA';
const DISPLAY = '"Bodoni Moda", Georgia, serif';
const SANS = 'Jost, system-ui, sans-serif';

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface Brand {
    groom: string;
    bride: string;
    /** e.g. "December 12, 2026" */
    date: string | null;
    /** e.g. "Dec 12, 2026" for the stamp postmark */
    postmarkDate: string | null;
    hashtag: string | null;
}

export interface GuestText {
    guestName?: string | null;
    wish?: string | null;
}

export interface SlotPhoto {
    source: CanvasImageSource;
    width: number;
    height: number;
}

// ---------------------------------------------------------------- pure helpers

/** The part of a photo that fills a slot of `dest` size (centre crop, "cover"). */
export function coverSource(photo: Size, dest: Size): Rect {
    return centerCrop(photo, dest.w / dest.h);
}

/** Frame lines scale with the canvas: min(w, h) / 1200. */
export function frameScale(layout: Layout): number {
    return Math.min(layout.canvas.w, layout.canvas.h) / 1200;
}

/** Largest font size from `start` down to `min` whose measured width fits `maxWidth`. */
export function fitFontSize(measure: (size: number) => number, maxWidth: number, start: number, min: number): number {
    let size = start;

    while (size > min && measure(size) > maxWidth) {
        size = Math.max(min, size * 0.95);
    }

    return size;
}

/** Greedy word wrap using a width measurer; a single over-long word gets its own line. */
export function wrapWords(text: string, measure: (line: string) => number, maxWidth: number): string[] {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;

        if (line && measure(candidate) > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }

    if (line) {
        lines.push(line);
    }

    return lines;
}

/** Shrinks the wish until it fits in at most `maxLines` lines inside the box. */
export function layoutWish(
    text: string,
    measureAt: (line: string, size: number) => number,
    box: Size,
    maxLines = 4,
): { size: number; lines: string[]; lineHeight: number } {
    let size = box.h * 0.2;
    const min = box.h * 0.075;

    for (;;) {
        const lines = wrapWords(text, (line) => measureAt(line, size), box.w);
        const lineHeight = size * 1.25;

        if ((lines.length <= maxLines && lines.length * lineHeight <= box.h * 0.66) || size <= min) {
            if (lines.length > maxLines) {
                const kept = lines.slice(0, maxLines);
                kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:!?]?$/, '')}…`;

                return { size, lines: kept, lineHeight };
            }

            return { size, lines, lineHeight };
        }

        size = Math.max(min, size * 0.92);
    }
}

// ------------------------------------------------------------- drawing helpers

function font(size: number, family: string, { italic = false, weight = 400 } = {}): string {
    return `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;
}

function setSpacing(ctx: Canvas2D, px: number): void {
    if ('letterSpacing' in ctx) {
        (ctx as Canvas2D & { letterSpacing: string }).letterSpacing = `${px}px`;
    }
}

function roundRectPath(ctx: Canvas2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function archPathOn(ctx: Canvas2D, { x, y, w, h }: Rect): void {
    const radius = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.arc(x + radius, y + radius, radius, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
}

function slotShapePath(ctx: Canvas2D, slot: LayoutSlot): void {
    if (slot.shape === 'arch') {
        archPathOn(ctx, slot);
    } else if (slot.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(slot.x + slot.w / 2, slot.y + slot.h / 2, slot.w / 2, slot.h / 2, 0, 0, Math.PI * 2);
    } else {
        ctx.beginPath();
        ctx.rect(slot.x, slot.y, slot.w, slot.h);
    }
}

function withSlotRotation(ctx: Canvas2D, slot: LayoutSlot, draw: () => void): void {
    ctx.save();

    if (slot.r) {
        const cx = slot.x + slot.w / 2;
        const cy = slot.y + slot.h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((slot.r * Math.PI) / 180);
        ctx.translate(-cx, -cy);
    }

    draw();
    ctx.restore();
}

function withShadow(ctx: Canvas2D, layout: Layout, draw: () => void): void {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = layout.canvas.w * 0.02;
    ctx.shadowOffsetY = layout.canvas.w * 0.008;
    draw();
    ctx.restore();
}

// ------------------------------------------------------------------ background

function drawBackground(ctx: Canvas2D, layout: Layout): void {
    const { w, h } = layout.canvas;
    const scale = frameScale(layout);

    if (layout.style === 'cinema') {
        ctx.fillStyle = '#070F26';
        ctx.fillRect(0, 0, w, h);

        return;
    }

    if (layout.theme === 'film') {
        ctx.fillStyle = NAVY;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#F4F6FB';

        for (let y = 13; y + 18 <= h; y += 44) {
            roundRectPath(ctx, 27, y, 26, 18, 4);
            ctx.fill();
            roundRectPath(ctx, w - 53, y, 26, 18, 4);
            ctx.fill();
        }

        return;
    }

    if (layout.theme === 'royal') {
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, ROYAL);
        gradient.addColorStop(1, NAVY);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(201, 161, 74, 0.16)';

        for (let y = 11; y < h; y += 22) {
            for (let x = 11; x < w; x += 22) {
                ctx.beginPath();
                ctx.arc(x, y, 1.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawDoubleFrame(ctx, w, h, scale, GOLD_LIGHT);

        return;
    }

    ctx.fillStyle = layout.style === 'heirloom' ? MIST_PAPER : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    drawDoubleFrame(ctx, w, h, scale, GOLD);
}

/** Two gold rules: 3px at inset 18 and 1.2px at inset 28, scaled with the canvas. */
function drawDoubleFrame(ctx: Canvas2D, w: number, h: number, scale: number, color: string): void {
    const outer = 18 * scale;
    const inner = 28 * scale;

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3 * scale, 3);
    ctx.strokeRect(outer, outer, w - outer * 2, h - outer * 2);
    ctx.lineWidth = Math.max(1.2 * scale, 1.4);
    ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2);
}

// ----------------------------------------------------------------------- slots

function drawSlot(ctx: Canvas2D, layout: Layout, slot: LayoutSlot, index: number, photo: SlotPhoto | null, brand: Brand): void {
    const isDark = layout.theme !== 'white';

    withSlotRotation(ctx, slot, () => {
        if (layout.style === 'polaroid') {
            const box = polaroidBox(slot);
            withShadow(ctx, layout, () => {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(box.x, box.y, box.w, box.h);
            });
        }

        if (layout.style === 'heirloom') {
            drawHeirloomMount(ctx, layout, slot);
        }

        if (layout.style === 'stamp') {
            drawStamp(ctx, layout, slot, index, brand);
        }

        ctx.save();
        slotShapePath(ctx, slot);
        ctx.clip();

        if (photo) {
            const crop = coverSource({ w: photo.width, h: photo.height }, slot);
            ctx.drawImage(photo.source, crop.x, crop.y, crop.w, crop.h, slot.x, slot.y, slot.w, slot.h);
        } else {
            ctx.fillStyle = isDark ? '#16296A' : '#DCE2EF';
            ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
        }

        ctx.restore();

        drawSlotOutline(ctx, layout, slot, isDark ? GOLD_LIGHT : GOLD);

        if (layout.style === 'cinema') {
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(slot.x, slot.y - 10);
            ctx.lineTo(slot.x + slot.w, slot.y - 10);
            ctx.moveTo(slot.x, slot.y + slot.h + 10);
            ctx.lineTo(slot.x + slot.w, slot.y + slot.h + 10);
            ctx.stroke();

            ctx.fillStyle = GOLD_LIGHT;
            ctx.font = font(22, SANS);
            ctx.textAlign = 'left';
            setSpacing(ctx, 3);
            ctx.fillText(`Scene ${index + 1}`, slot.x + 18, slot.y + 36);
            setSpacing(ctx, 0);
        }
    });
}

function drawSlotOutline(ctx: Canvas2D, layout: Layout, slot: LayoutSlot, color: string): void {
    if (layout.theme === 'film' || ['polaroid', 'heirloom', 'magazine', 'stamp'].includes(layout.style ?? '')) {
        return;
    }

    ctx.strokeStyle = color;

    if (slot.shape === 'arch') {
        ctx.lineWidth = 3;
        archPathOn(ctx, slot);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        archPathOn(ctx, { x: slot.x - 14, y: slot.y - 14, w: slot.w + 28, h: slot.h + 28 });
        ctx.stroke();

        return;
    }

    if (slot.shape === 'circle') {
        const cx = slot.x + slot.w / 2;
        const cy = slot.y + slot.h / 2;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, slot.w / 2, slot.h / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, slot.w / 2 - 12, slot.h / 2 - 12, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        return;
    }

    ctx.lineWidth = 2.5;
    ctx.strokeRect(slot.x, slot.y, slot.w, slot.h);
}

/** A white 14px mount with a faint shadow and four gold photo corners. */
function drawHeirloomMount(ctx: Canvas2D, layout: Layout, slot: LayoutSlot): void {
    const border = 14;
    const x = slot.x - border;
    const y = slot.y - border;
    const w = slot.w + border * 2;
    const h = slot.h + border * 2;
    const corner = Math.min(slot.w, slot.h) * 0.12;

    withShadow(ctx, layout, () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, w, h);
    });

    ctx.fillStyle = GOLD;
    const triangles: [number, number, number, number][] = [
        [x, y, corner, corner],
        [x + w, y, -corner, corner],
        [x, y + h, corner, -corner],
        [x + w, y + h, -corner, -corner],
    ];

    for (const [px, py, dx, dy] of triangles) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx, py);
        ctx.lineTo(px, py + dy);
        ctx.closePath();
        ctx.fill();
    }
}

/** A postage stamp: white border with perforated edges, denomination and a postmark. */
function drawStamp(ctx: Canvas2D, layout: Layout, slot: LayoutSlot, index: number, brand: Brand): void {
    const border = 26;
    const x = slot.x - border;
    const y = slot.y - border;
    const w = slot.w + border * 2;
    const h = slot.h + border * 2;
    const step = 22;
    const radius = 7;

    // Draw the perforated paper on its own canvas, then place it with a shadow.
    const paper = createCanvas(Math.ceil(w + radius * 2), Math.ceil(h + radius * 2));
    const paperCtx = paper.getContext('2d') as Canvas2D;
    paperCtx.fillStyle = '#FFFFFF';
    paperCtx.fillRect(radius, radius, w, h);
    paperCtx.globalCompositeOperation = 'destination-out';

    for (let px = 0; px <= w; px += step) {
        for (const py of [0, h]) {
            paperCtx.beginPath();
            paperCtx.arc(radius + px, radius + py, radius, 0, Math.PI * 2);
            paperCtx.fill();
        }
    }

    for (let py = 0; py <= h; py += step) {
        for (const px of [0, w]) {
            paperCtx.beginPath();
            paperCtx.arc(radius + px, radius + py, radius, 0, Math.PI * 2);
            paperCtx.fill();
        }
    }

    withShadow(ctx, layout, () => ctx.drawImage(paper, x - radius, y - radius));
    releaseCanvas(paper);

    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = font(22, DISPLAY, { weight: 600 });
    ctx.fillText('₱ 20', x + w - 34, y + h - 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = ROYAL;
    ctx.font = font(18, DISPLAY, { italic: true });
    ctx.fillText('Mahal kita', x + 34, y + h - 8);

    if (index === 0) {
        drawPostmark(ctx, x + w - 20, y + 20, brand.postmarkDate);
    }
}

function drawPostmark(ctx: Canvas2D, cx: number, cy: number, date: string | null): void {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = GOLD;
    ctx.fillStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = font(15, SANS);
    setSpacing(ctx, 2);
    ctx.fillText(date ?? 'Just married', cx, cy - 8);
    setSpacing(ctx, 0);
    ctx.font = font(22, DISPLAY, { italic: true });
    ctx.fillText('E & J', cx, cy + 18);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 110, cy + 46);

    for (let i = 0; i < 5; i++) {
        const sx = cx - 110 + i * 40;
        ctx.quadraticCurveTo(sx + 10, cy + 36, sx + 20, cy + 46);
        ctx.quadraticCurveTo(sx + 30, cy + 56, sx + 40, cy + 46);
    }

    ctx.stroke();
    ctx.restore();
}

// ------------------------------------------------------------ special styles

function drawMagazine(ctx: Canvas2D, layout: Layout, brand: Brand, text: GuestText): void {
    const { w, h } = layout.canvas;

    const top = ctx.createLinearGradient(0, 0, 0, h * 0.3);
    top.addColorStop(0, 'rgba(12, 28, 69, 0.92)');
    top.addColorStop(1, 'rgba(12, 28, 69, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.3);

    const bottom = ctx.createLinearGradient(0, h, 0, h * 0.62);
    bottom.addColorStop(0, 'rgba(12, 28, 69, 0.95)');
    bottom.addColorStop(1, 'rgba(12, 28, 69, 0)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);

    // The one place capitals are allowed: it is a magazine masthead.
    const masthead = `${brand.groom} & ${brand.bride}`.toUpperCase();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    const size = fitFontSize(
        (s) => {
            ctx.font = font(s, DISPLAY, { weight: 600 });

            return ctx.measureText(masthead).width;
        },
        w * 0.86,
        h * 0.075,
        h * 0.03,
    );
    ctx.font = font(size, DISPLAY, { weight: 600 });
    ctx.fillText(masthead, w / 2, h * 0.095);

    ctx.fillStyle = GOLD_LIGHT;
    ctx.font = font(h * 0.016, SANS);
    setSpacing(ctx, 4);
    ctx.fillText(brand.date ? `Wedding issue  ◆  ${brand.date}` : 'The wedding issue', w / 2, h * 0.135);
    setSpacing(ctx, 0);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(h * 0.026, SANS, { weight: 500 });
    ctx.fillText(text.guestName?.trim() ? `Starring ${text.guestName.trim()}` : 'Starring you', w * 0.07, h * 0.7);
    ctx.font = font(h * 0.02, SANS);
    ctx.fillText('The happiest day of the year', w * 0.07, h * 0.745);
    ctx.fillText('Inside: 300 photos from the party', w * 0.07, h * 0.785);
}

function drawWishCard(ctx: Canvas2D, layout: Layout, text: GuestText): void {
    const box = layout.text;

    if (!box) {
        return;
    }

    const { w } = layout.canvas;
    const wish = text.wish?.trim() || 'With love';
    const area = { w: w * 0.78, h: box.h };
    const measureAt = (line: string, size: number) => {
        ctx.font = font(size, DISPLAY, { italic: true });

        return ctx.measureText(line).width;
    };
    const { size, lines, lineHeight } = layoutWish(wish, measureAt, area);
    const name = text.guestName?.trim();
    const blockHeight = lines.length * lineHeight + (name ? lineHeight * 0.9 : 0);
    let y = box.y + (box.h - blockHeight) / 2 + size;

    ctx.textAlign = 'center';
    ctx.fillStyle = NAVY;
    ctx.font = font(size, DISPLAY, { italic: true });

    for (const line of lines) {
        ctx.fillText(line, w / 2, y);
        y += lineHeight;
    }

    if (name) {
        ctx.fillStyle = ROYAL;
        ctx.font = font(Math.max(box.h * 0.075, size * 0.55), SANS);
        ctx.fillText(`— ${name}`, w / 2, y + lineHeight * 0.1);
    }
}

function drawHeirloomCaption(ctx: Canvas2D, layout: Layout): void {
    const last = layout.slots[layout.slots.length - 1];

    if (!last) {
        return;
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = ROYAL;
    ctx.font = font(34, DISPLAY, { italic: true });
    ctx.fillText('Our wedding day', last.x + last.w - 10, last.y + last.h + 54);
}

// ---------------------------------------------------------------------- footer

/** Ornament → names (Bodoni italic, at most 84% wide) → date → hashtag. Stacked names under 800px wide. */
function drawFooter(ctx: Canvas2D, layout: Layout, brand: Brand): void {
    const { w } = layout.canvas;
    const { y, h } = layout.footer;
    const cx = w / 2;
    const isDark = layout.theme !== 'white';
    const ink = isDark ? INK_LIGHT : NAVY;
    const accent = isDark ? GOLD_LIGHT : GOLD;

    ctx.textAlign = 'center';

    if (layout.style === 'magazine') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = font(h * 0.13, SANS);
        setSpacing(ctx, 4);
        ctx.fillText(brand.date ?? '', cx, y + h * 0.48);
        setSpacing(ctx, 0);
        ctx.fillStyle = GOLD_LIGHT;
        ctx.font = font(h * 0.12, SANS);
        ctx.fillText(brand.hashtag ?? '', cx, y + h * 0.74);

        return;
    }

    const metrics = footerMetrics(layout);
    const ornamentY = y + h * (w < 800 ? 0.16 : metrics.ornamentY);
    const half = Math.min(w * 0.16, 150);
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, ornamentY);
    ctx.lineTo(cx - 16, ornamentY);
    ctx.moveTo(cx + 16, ornamentY);
    ctx.lineTo(cx + half, ornamentY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, ornamentY - 8);
    ctx.lineTo(cx + 8, ornamentY);
    ctx.lineTo(cx, ornamentY + 8);
    ctx.lineTo(cx - 8, ornamentY);
    ctx.closePath();
    ctx.fill();

    if (w < 800) {
        const size = fitFontSize(
            (s) => {
                ctx.font = font(s, DISPLAY, { italic: true });

                return Math.max(ctx.measureText(brand.groom).width, ctx.measureText(brand.bride).width);
            },
            w * 0.84,
            h * 0.17,
            h * 0.08,
        );

        ctx.fillStyle = ink;
        ctx.font = font(size, DISPLAY, { italic: true });
        ctx.fillText(brand.groom, cx, y + h * 0.39);
        ctx.fillStyle = accent;
        ctx.font = font(size * 0.62, DISPLAY, { italic: true });
        ctx.fillText('&', cx, y + h * 0.52);
        ctx.fillStyle = ink;
        ctx.font = font(size, DISPLAY, { italic: true });
        ctx.fillText(brand.bride, cx, y + h * 0.69);

        if (brand.date) {
            ctx.font = font(h * 0.055, SANS, { weight: 500 });
            setSpacing(ctx, 3);
            ctx.fillText(brand.date, cx, y + h * 0.83);
            setSpacing(ctx, 0);
        }

        if (brand.hashtag) {
            ctx.fillStyle = accent;
            ctx.font = font(h * 0.055, SANS);
            ctx.fillText(brand.hashtag, cx, y + h * 0.94);
        }

        return;
    }

    const names = layout.style === 'cinema' ? `${brand.groom} & ${brand.bride} — a love story` : `${brand.groom} & ${brand.bride}`;
    const size = fitFontSize(
        (s) => {
            ctx.font = font(s, DISPLAY, { italic: true });

            return ctx.measureText(names).width;
        },
        w * 0.84,
        h * metrics.nameSize,
        h * 0.08,
    );

    ctx.fillStyle = ink;
    ctx.font = font(size, DISPLAY, { italic: true });
    ctx.fillText(names, cx, y + h * metrics.nameY);

    if (brand.date) {
        ctx.font = font(h * metrics.dateSize, SANS, { weight: 500 });
        setSpacing(ctx, 4);
        ctx.fillText(brand.date, cx, y + h * metrics.dateY);
        setSpacing(ctx, 0);
    }

    if (brand.hashtag) {
        ctx.fillStyle = accent;
        ctx.font = font(h * metrics.tagSize, SANS);
        ctx.fillText(brand.hashtag, cx, y + h * metrics.tagY);
    }
}

// ------------------------------------------------------------------ public API

/** Draws a whole collage. `photos` must already have the look applied. */
export function drawCollage(ctx: Canvas2D, layout: Layout, photos: (SlotPhoto | null)[], brand: Brand, text: GuestText = {}): void {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    drawBackground(ctx, layout);

    layout.slots.forEach((slot, index) => drawSlot(ctx, layout, slot, index, photos[index] ?? null, brand));

    if (layout.style === 'magazine') {
        drawMagazine(ctx, layout, brand, text);
    }

    if (layout.style === 'wishcard') {
        drawWishCard(ctx, layout, text);
    }

    if (layout.style === 'heirloom') {
        drawHeirloomCaption(ctx, layout);
    }

    drawFooter(ctx, layout, brand);
    ctx.restore();
}

function createCanvas(width: number, height: number): AnyCanvas {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    return canvas;
}

function releaseCanvas(canvas: AnyCanvas): void {
    canvas.width = 0;
    canvas.height = 0;
}

async function canvasToJpeg(canvas: AnyCanvas, quality: number): Promise<Blob> {
    if ('convertToBlob' in canvas) {
        return canvas.convertToBlob({ type: 'image/jpeg', quality });
    }

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The collage could not be saved.'))), 'image/jpeg', quality);
    });
}

let fontsReady: Promise<void> | null = null;

/** Waits for the self-hosted fonts so the first collage never falls back to Georgia. */
export function ensureCollageFonts(): Promise<void> {
    fontsReady ??= Promise.all(
        ['italic 400 40px "Bodoni Moda"', '400 40px "Bodoni Moda"', '600 40px "Bodoni Moda"', '400 20px Jost', '500 20px Jost'].map((spec) =>
            document.fonts.load(spec),
        ),
    ).then(() => undefined);

    return fontsReady;
}

/** One slot's photo, cropped to the slot and with the look applied to its pixels. */
async function prepareSlotPhoto(shot: Blob, slot: LayoutSlot, look: LookSlug): Promise<SlotPhoto> {
    const bitmap = await createImageBitmap(shot);
    const width = Math.round(slot.w);
    const height = Math.round(slot.h);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as Canvas2D;

    try {
        const crop = coverSource({ w: bitmap.width, h: bitmap.height }, { w: width, h: height });
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
        await applyLook(ctx, width, height, look);
    } finally {
        bitmap.close();
    }

    return { source: canvas, width, height };
}

export interface ComposeOptions extends GuestText {
    layout: Layout;
    shots: (Blob | null)[];
    look: LookSlug;
    brand: Brand;
}

/** Builds the final full-size collage JPEG (quality 0.92, sRGB). */
export async function composeCollage({ layout, shots, look, brand, guestName, wish }: ComposeOptions): Promise<Blob> {
    await ensureCollageFonts();

    const photos = await Promise.all(layout.slots.map((slot, index) => (shots[index] ? prepareSlotPhoto(shots[index], slot, look) : null)));
    const canvas = createCanvas(layout.canvas.w, layout.canvas.h);
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' }) as Canvas2D;

    try {
        drawCollage(ctx, layout, photos, brand, { guestName, wish });

        return await canvasToJpeg(canvas, COLLAGE_JPEG_QUALITY);
    } finally {
        photos.forEach((photo) => photo && releaseCanvas(photo.source as AnyCanvas));
        releaseCanvas(canvas);
    }
}
