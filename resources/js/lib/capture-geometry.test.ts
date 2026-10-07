import { describe, expect, it } from 'vitest';
import { centerCrop, fitWithin, layoutGuide } from './capture-geometry';

describe('centerCrop', () => {
    it('trims the sides of a wide frame for a square slot', () => {
        expect(centerCrop({ w: 1920, h: 1440 }, 1)).toEqual({ x: 240, y: 0, w: 1440, h: 1440 });
    });

    it('trims top and bottom of a tall frame for a landscape slot', () => {
        expect(centerCrop({ w: 1440, h: 1920 }, 2)).toEqual({ x: 0, y: 600, w: 1440, h: 720 });
    });

    it('keeps the whole frame when the aspect already matches', () => {
        expect(centerCrop({ w: 1600, h: 1200 }, 4 / 3)).toEqual({ x: 0, y: 0, w: 1600, h: 1200 });
    });
});

describe('fitWithin', () => {
    it('limits the long side to 1600px', () => {
        expect(fitWithin({ w: 1440, h: 1920 }, 1600)).toEqual({ w: 1200, h: 1600 });
    });

    it('never upscales a small frame', () => {
        expect(fitWithin({ w: 640, h: 480 }, 1600)).toEqual({ w: 640, h: 480 });
    });
});

describe('layoutGuide', () => {
    it('fills the screen like cover when the crop is small enough to fit', () => {
        const { video, guide } = layoutGuide({ w: 1920, h: 1080 }, { w: 1920, h: 1080 }, 0.5);

        expect(video).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
        expect(guide).toEqual({ x: 690, y: 0, w: 540, h: 1080 });
    });

    it('shrinks the video on a portrait phone so a 4:5 crop keeps its full width', () => {
        const { video, guide } = layoutGuide({ w: 390, h: 844 }, { w: 1440, h: 1920 }, 1040 / 1300);

        expect(video.w).toBeCloseTo(390);
        expect(guide.w).toBeCloseTo(390);
        expect(guide.y).toBeGreaterThan(0);
        expect(guide.y + guide.h).toBeLessThan(844);
    });

    it('shrinks the video so a wide crop is never cut off on a portrait phone', () => {
        const screen = { w: 390, h: 844 };
        const { video, guide } = layoutGuide(screen, { w: 1440, h: 1920 }, 1680 / 900);

        expect(guide.w).toBeCloseTo(390);
        expect(guide.x).toBeCloseTo(0);
        expect(video.w).toBeCloseTo(390);
        expect(video.h).toBeLessThan(screen.h);
    });

    it('keeps the guide inside the safe area between the bars', () => {
        const safe = { x: 0, y: 80, w: 1180, h: 600 };
        const { guide } = layoutGuide({ w: 1180, h: 820 }, { w: 1920, h: 1440 }, 1040 / 1300, safe);

        expect(guide.y).toBeGreaterThanOrEqual(80 - 1e-9);
        expect(guide.y + guide.h).toBeLessThanOrEqual(680 + 1e-9);
    });

    it('maps the guide to the same part of the video as the saved crop', () => {
        const videoSize = { w: 1920, h: 1080 };
        const aspect = 3 / 4;
        const { video, guide } = layoutGuide({ w: 1180, h: 820 }, videoSize, aspect);
        const crop = centerCrop(videoSize, aspect);
        const scale = video.w / videoSize.w;

        expect(guide.x).toBeCloseTo(video.x + crop.x * scale);
        expect(guide.w).toBeCloseTo(crop.w * scale);
    });
});
