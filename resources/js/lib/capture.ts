import { centerCrop, fitWithin, type Rect, type Size } from '@/lib/capture-geometry';

/** Raw shots: at most 1600px on the long side, JPEG quality 0.85. */
export const RAW_MAX_LONG_SIDE = 1600;
export const RAW_JPEG_QUALITY = 0.85;

const TAKE_PHOTO_TIMEOUT_MS = 1500;

interface ImageCaptureLike {
    takePhoto: (settings?: { fillLightMode?: string }) => Promise<Blob>;
    getPhotoCapabilities?: () => Promise<{ fillLightMode?: string[] }>;
}

/** Never fire the phone's LED flash: the preview did not show it, so the photo must not either. */
async function photoSettings(imageCapture: ImageCaptureLike): Promise<{ fillLightMode?: string }> {
    try {
        const capabilities = await imageCapture.getPhotoCapabilities?.();

        return capabilities?.fillLightMode?.includes('off') ? { fillLightMode: 'off' } : {};
    } catch {
        return {};
    }
}

type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

function imageCaptureFor(track: MediaStreamTrack): ImageCaptureLike | null {
    const Constructor = (window as typeof window & { ImageCapture?: ImageCaptureConstructor }).ImageCapture;

    if (!Constructor || track.readyState !== 'live') {
        return null;
    }

    try {
        return new Constructor(track);
    } catch {
        return null;
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The photo could not be encoded.'))), 'image/jpeg', quality);
    });
}

/** Draws `region` of `source` into a new JPEG, mirrored for the front camera. */
async function encodeRegion(source: CanvasImageSource, region: Rect, mirror: boolean): Promise<Blob> {
    const out = fitWithin(region, RAW_MAX_LONG_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = out.w;
    canvas.height = out.h;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('The photo could not be drawn.');
    }

    if (mirror) {
        context.translate(out.w, 0);
        context.scale(-1, 1);
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(source, region.x, region.y, region.w, region.h, 0, 0, out.w, out.h);

    try {
        return await canvasToJpeg(canvas, RAW_JPEG_QUALITY);
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * Full-resolution still from ImageCapture, cropped first to what the live video
 * shows and then to the slot. Returns null when the browser cannot do it or the
 * result does not match the preview, so the caller falls back to a video frame.
 */
async function takeFullResolution(track: MediaStreamTrack, videoSize: Size, aspect: number, mirror: boolean): Promise<Blob | null> {
    const imageCapture = imageCaptureFor(track);

    if (!imageCapture) {
        return null;
    }

    let bitmap: ImageBitmap | null = null;

    try {
        const photo = await withTimeout(
            photoSettings(imageCapture).then((settings) => imageCapture.takePhoto(settings)),
            TAKE_PHOTO_TIMEOUT_MS,
        );
        bitmap = await createImageBitmap(photo);

        // A still rotated differently from the preview would not match the guide.
        const photoIsPortrait = bitmap.height > bitmap.width;
        const videoIsPortrait = videoSize.h > videoSize.w;

        if (photoIsPortrait !== videoIsPortrait) {
            return null;
        }

        const visible = centerCrop({ w: bitmap.width, h: bitmap.height }, videoSize.w / videoSize.h);
        const slot = centerCrop(visible, aspect);

        return await encodeRegion(bitmap, { ...slot, x: visible.x + slot.x, y: visible.y + slot.y }, mirror);
    } catch {
        return null;
    } finally {
        bitmap?.close();
    }
}

export interface CaptureOptions {
    video: HTMLVideoElement;
    track: MediaStreamTrack | null;
    /** Slot width / height: the saved shot is exactly the centre crop the guide shows. */
    aspect: number;
    /** Front camera: the saved photo is mirrored like the preview. */
    mirror: boolean;
    /** Try ImageCapture.takePhoto() first (full sensor resolution on Android Chrome). */
    preferFullResolution?: boolean;
}

/** Captures one raw shot as a JPEG Blob matching the gold guide. */
export async function captureShot({ video, track, aspect, mirror, preferFullResolution = true }: CaptureOptions): Promise<Blob> {
    const videoSize = { w: video.videoWidth, h: video.videoHeight };

    if (!videoSize.w || !videoSize.h) {
        throw new Error('The camera is not ready yet.');
    }

    if (preferFullResolution && track) {
        const still = await takeFullResolution(track, videoSize, aspect, mirror);

        if (still) {
            return still;
        }
    }

    return encodeRegion(video, centerCrop(videoSize, aspect), mirror);
}

/** Turns a photo picked from the phone's own camera app into a raw shot for a slot. */
export async function shotFromFile(file: Blob, aspect: number): Promise<Blob> {
    const bitmap = await createImageBitmap(file);

    try {
        return await encodeRegion(bitmap, centerCrop({ w: bitmap.width, h: bitmap.height }, aspect), false);
    } finally {
        bitmap.close();
    }
}
