import { applyLook } from '@/lib/apply-look';
import { centerCrop } from '@/lib/capture-geometry';
import { ensureCollageFonts, type Brand } from '@/lib/compose';
import type { LookSlug } from '@/types';
import { applyPalette, GIFEncoder, quantize, type Palette } from 'gifenc';

/**
 * Boomerangs: a 1.5 s burst of frames, played forwards then backwards, set in
 * a branded 4:5 frame and encoded as a short looping clip.
 */

export type BoomerangFrameId = 'classic' | 'story' | 'square';

/** A branded boomerang frame: navy, a gold hairline around the photo, names and date below. */
export interface BoomerangFrame {
    id: BoomerangFrameId;
    name: string;
    description: string;
    w: number;
    h: number;
    photo: { x: number; y: number; w: number; h: number };
    footer: { y: number; h: number };
}

export const BOOMERANG_FRAMES: Record<BoomerangFrameId, BoomerangFrame> = {
    classic: {
        id: 'classic',
        name: 'Classic',
        description: 'Portrait, with your names below',
        w: 720,
        h: 900,
        photo: { x: 24, y: 24, w: 672, h: 744 },
        footer: { y: 768, h: 132 },
    },
    story: {
        id: 'story',
        name: 'Story',
        description: 'Tall, for Instagram and Facebook stories',
        w: 720,
        h: 1280,
        photo: { x: 24, y: 24, w: 672, h: 1104 },
        footer: { y: 1128, h: 152 },
    },
    square: {
        id: 'square',
        name: 'Feed post',
        description: 'Square, for a feed post',
        w: 720,
        h: 720,
        photo: { x: 24, y: 24, w: 672, h: 580 },
        footer: { y: 604, h: 116 },
    },
};

/** The classic frame (the default). */
export const BOOMERANG_FRAME = BOOMERANG_FRAMES.classic;

/** The shape of the live guide while recording: exactly the photo area of the frame. */
export function boomerangAspect(frame: BoomerangFrame = BOOMERANG_FRAME): number {
    return frame.photo.w / frame.photo.h;
}

export const BOOMERANG_ASPECT = boomerangAspect(BOOMERANG_FRAME);

export const BURST_FRAMES = 24;
export const BURST_MS = 1500;
export const PLAYBACK_FPS = 30;
export const LOOPS = 3;

const GIF_WIDTH = 480;
const POSTER_QUALITY = 0.88;

export interface BoomerangClip {
    clip: Blob;
    poster: Blob;
    mime: string;
    width: number;
    height: number;
    durationMs: number;
}

// --------------------------------------------------------------- pure helpers

/** [a, b, c, d] → [a, b, c, d, c, b]: forwards, then back without repeating the ends. */
export function pingPong<T>(frames: T[]): T[] {
    return frames.length < 3 ? [...frames] : [...frames, ...frames.slice(1, -1).reverse()];
}

/** When to grab each frame of the burst, in ms from the start. */
export function burstSchedule(count = BURST_FRAMES, durationMs = BURST_MS): number[] {
    return Array.from({ length: count }, (_, index) => Math.round((index * durationMs) / count));
}

/** The best MediaRecorder format this browser can record: MP4 first (iPhone), then WebM. */
export function pickRecorderMime(isTypeSupported: (mime: string) => boolean): string | null {
    const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

    return candidates.find((mime) => isTypeSupported(mime)) ?? null;
}

export function clipDurationMs(sequenceLength: number, fps = PLAYBACK_FPS, loops = LOOPS): number {
    return Math.round(((sequenceLength * loops) / fps) * 1000);
}

// ------------------------------------------------------------------ capturing

const sleepUntil = (time: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, time - performance.now())));

/**
 * Grabs BURST_FRAMES frames over BURST_MS from the live video: each the centre
 * crop the guide shows, mirrored for the front camera, at most 720px.
 */
export async function captureBurst(
    video: CanvasImageSource & { videoWidth?: number; videoHeight?: number; width?: number; height?: number },
    mirror: boolean,
    onProgress?: (fraction: number) => void,
    frame: BoomerangFrame = BOOMERANG_FRAME,
): Promise<ImageBitmap[]> {
    const source = { w: Number(video.videoWidth ?? video.width ?? 0), h: Number(video.videoHeight ?? video.height ?? 0) };

    if (!source.w || !source.h) {
        throw new Error('The camera is not ready yet.');
    }

    const crop = centerCrop(source, boomerangAspect(frame));
    const { w, h } = frame.photo;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    if (mirror) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
    }

    const frames: ImageBitmap[] = [];
    const start = performance.now();

    for (const offset of burstSchedule()) {
        await sleepUntil(start + offset);
        ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
        frames.push(await createImageBitmap(canvas));
        onProgress?.(frames.length / BURST_FRAMES);
    }

    canvas.width = 0;
    canvas.height = 0;

    return frames;
}

// ------------------------------------------------------------------- framing

function drawFrame(ctx: CanvasRenderingContext2D, photo: CanvasImageSource, brand: Brand, frame: BoomerangFrame): void {
    const { w, h, photo: area, footer } = frame;

    ctx.fillStyle = '#0C1C45';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(photo, area.x, area.y, area.w, area.h);

    // Gold hairline around the photo.
    ctx.strokeStyle = '#E8D29B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(area.x - 7, area.y - 7, area.w + 14, area.h + 14);

    const cx = w / 2;
    const names = `${brand.groom} & ${brand.bride}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#EEF2FA';
    let size = 46;
    ctx.font = `italic 400 ${size}px "Bodoni Moda", Georgia, serif`;

    while (ctx.measureText(names).width > w * 0.84 && size > 24) {
        size -= 2;
        ctx.font = `italic 400 ${size}px "Bodoni Moda", Georgia, serif`;
    }

    ctx.fillText(names, cx, footer.y + footer.h * 0.5);

    if (brand.date) {
        ctx.fillStyle = '#E8D29B';
        ctx.font = '500 17px Jost, system-ui, sans-serif';
        if ('letterSpacing' in ctx) {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '3px';
        }
        ctx.fillText(brand.date, cx, footer.y + footer.h * 0.8);
        if ('letterSpacing' in ctx) {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
        }
    }
}

/** Applies the look to each burst frame and sets it in the branded frame. */
async function brandFrames(frames: ImageBitmap[], look: LookSlug, brand: Brand, frame: BoomerangFrame, onProgress?: (fraction: number) => void): Promise<ImageBitmap[]> {
    await ensureCollageFonts();

    const { w, h, photo } = frame;
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = photo.w;
    photoCanvas.height = photo.h;
    const photoCtx = photoCanvas.getContext('2d', { willReadFrequently: true })!;
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = w;
    frameCanvas.height = h;
    const frameCtx = frameCanvas.getContext('2d')!;
    const branded: ImageBitmap[] = [];

    for (const [index, burstFrame] of frames.entries()) {
        photoCtx.drawImage(burstFrame, 0, 0, photo.w, photo.h);
        await applyLook(photoCtx, photo.w, photo.h, look);
        drawFrame(frameCtx, photoCanvas, brand, frame);
        branded.push(await createImageBitmap(frameCanvas));
        onProgress?.((index + 1) / frames.length);
    }

    photoCanvas.width = 0;
    frameCanvas.width = 0;

    return branded;
}

// ------------------------------------------------------------------- encoding

function canRecordCanvas(): string | null {
    if (typeof MediaRecorder === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) {
        return null;
    }

    return pickRecorderMime((mime) => MediaRecorder.isTypeSupported(mime));
}

/** Plays the sequence LOOPS times on a canvas and records it in real time. */
async function recordClip(sequence: ImageBitmap[], mime: string, frame: BoomerangFrame): Promise<Blob> {
    const { w, h } = frame;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // Kept in the document (but invisible) so every browser keeps painting it.
    Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none' });
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(sequence[0], 0, 0);

    const stream = canvas.captureStream(PLAYBACK_FPS);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data);
        }
    };
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

    try {
        recorder.start(250);
        const start = performance.now();
        const interval = 1000 / PLAYBACK_FPS;
        const total = sequence.length * LOOPS;

        for (let i = 0; i < total; i++) {
            await sleepUntil(start + i * interval);
            ctx.drawImage(sequence[i % sequence.length], 0, 0);
        }

        await sleepUntil(start + total * interval + interval);
        recorder.stop();
        await stopped;
    } finally {
        stream.getTracks().forEach((track) => track.stop());
        canvas.remove();
        canvas.width = 0;
    }

    const clip = new Blob(chunks, { type: mime.split(';')[0] });

    if (clip.size < 2000) {
        throw new Error('The recording came out empty.');
    }

    return clip;
}

/** Animated GIF fallback for browsers that cannot record a canvas. Loops forever. */
function encodeGif(sequence: ImageBitmap[], frame: BoomerangFrame): Blob {
    const width = GIF_WIDTH;
    const height = Math.round((GIF_WIDTH * frame.h) / frame.w);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    // One shared palette from a few frames: faster, and no colour flicker between frames.
    const samples = [0, Math.floor(sequence.length / 3), Math.floor((sequence.length * 2) / 3)].map((index) => {
        ctx.drawImage(sequence[index], 0, 0, width, height);

        return ctx.getImageData(0, 0, width, height).data;
    });
    const combined = new Uint8ClampedArray(samples.reduce((sum, sample) => sum + sample.length, 0));
    samples.reduce((offset, sample) => (combined.set(sample, offset), offset + sample.length), 0);
    const palette: Palette = quantize(combined, 256);

    const gif = GIFEncoder();
    const delay = Math.round(1000 / PLAYBACK_FPS);

    sequence.forEach((bitmap, index) => {
        ctx.drawImage(bitmap, 0, 0, width, height);
        const pixels = applyPalette(ctx.getImageData(0, 0, width, height).data, palette);
        gif.writeFrame(pixels, width, height, index === 0 ? { palette, delay, repeat: 0 } : { delay });
    });

    gif.finish();
    canvas.width = 0;

    return new Blob([gif.bytes()], { type: 'image/gif' });
}

function bitmapToJpeg(bitmap: ImageBitmap): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => {
                canvas.width = 0;
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('The poster could not be saved.'));
                }
            },
            'image/jpeg',
            POSTER_QUALITY,
        ),
    );
}

export interface BuildOptions {
    frames: ImageBitmap[];
    look: LookSlug;
    brand: Brand;
    frame?: BoomerangFrame;
    /** 0–1 across framing and encoding. */
    onProgress?: (fraction: number) => void;
}

/**
 * Turns a burst into the finished boomerang: look → branded frame → ping-pong
 * → clip (MP4 on iPhone, WebM on Android/desktop, GIF as a last resort) plus
 * a poster JPEG.
 */
export async function buildBoomerang({ frames, look, brand, frame = BOOMERANG_FRAME, onProgress }: BuildOptions): Promise<BoomerangClip> {
    const branded = await brandFrames(frames, look, brand, frame, (fraction) => onProgress?.(fraction * 0.35));
    const sequence = pingPong(branded);

    try {
        const poster = await bitmapToJpeg(branded[0]);
        const mime = canRecordCanvas();
        let clip: Blob | null = null;
        let durationMs = clipDurationMs(sequence.length);
        let size: { width: number; height: number } = { width: frame.w, height: frame.h };

        if (mime) {
            const ticker = window.setInterval(() => onProgress?.(0.4), 500);

            try {
                clip = await recordClip(sequence, mime, frame);
            } catch {
                clip = null;
            } finally {
                window.clearInterval(ticker);
            }
        }

        if (!clip) {
            onProgress?.(0.5);
            clip = encodeGif(sequence, frame);
            durationMs = clipDurationMs(sequence.length, PLAYBACK_FPS, 1);
            size = { width: GIF_WIDTH, height: Math.round((GIF_WIDTH * frame.h) / frame.w) };
        }

        onProgress?.(1);

        return { clip, poster, mime: clip.type, ...size, durationMs };
    } finally {
        branded.forEach((bitmap) => bitmap.close());
    }
}
