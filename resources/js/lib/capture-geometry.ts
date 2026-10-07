/**
 * Pure geometry behind "what is inside the gold guide is exactly what is in
 * the photo". Kept free of the DOM so it can be unit tested.
 */

export interface Size {
    w: number;
    h: number;
}

export interface Rect extends Size {
    x: number;
    y: number;
}

/** The largest centred rectangle of `aspect` (w / h) that fits inside `source`. */
export function centerCrop(source: Size, aspect: number): Rect {
    if (source.w / source.h > aspect) {
        const w = source.h * aspect;

        return { x: (source.w - w) / 2, y: 0, w, h: source.h };
    }

    const h = source.w / aspect;

    return { x: 0, y: (source.h - h) / 2, w: source.w, h };
}

/** Scales `size` down (never up) so its longer side is at most `maxLong`. */
export function fitWithin(size: Size, maxLong: number): Size {
    const scale = Math.min(1, maxLong / Math.max(size.w, size.h));

    return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

export interface GuideLayout {
    /** Where to draw the video element (it may be smaller than the screen). */
    video: Rect;
    /** The gold guide: the exact part of the video that will be saved. */
    guide: Rect;
}

/**
 * Places the live video and the guide on screen. The video fills the screen
 * like object-fit: cover, unless that would push part of the saved crop off
 * screen or under the controls; then the video shrinks until the whole crop
 * is visible inside `safe` (the area between the top and bottom bars).
 */
export function layoutGuide(screen: Size, video: Size, aspect: number, safe: Rect = { x: 0, y: 0, ...screen }): GuideLayout {
    const crop = centerCrop(video, aspect);
    const coverScale = Math.max(screen.w / video.w, screen.h / video.h);
    const fitScale = Math.min(safe.w / crop.w, safe.h / crop.h);
    const scale = Math.min(coverScale, fitScale);

    const shown: Size = { w: video.w * scale, h: video.h * scale };
    const guide: Size = { w: crop.w * scale, h: crop.h * scale };
    const centerX = safe.x + safe.w / 2;
    const centerY = safe.y + safe.h / 2;

    return {
        video: { x: centerX - shown.w / 2, y: centerY - shown.h / 2, ...shown },
        guide: { x: centerX - guide.w / 2, y: centerY - guide.h / 2, ...guide },
    };
}
