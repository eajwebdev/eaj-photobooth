import { describe, expect, it } from 'vitest';
import { BOOMERANG_ASPECT, BOOMERANG_FRAME, burstSchedule, clipDurationMs, pickRecorderMime, pingPong } from './boomerang';

describe('pingPong', () => {
    it('plays forwards then back without doubling the end frames', () => {
        expect(pingPong(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd', 'c', 'b']);
    });

    it('turns 24 burst frames into a 46-frame loop', () => {
        expect(pingPong(Array.from({ length: 24 }, (_, i) => i))).toHaveLength(46);
    });

    it('leaves very short bursts as they are', () => {
        expect(pingPong(['a', 'b'])).toEqual(['a', 'b']);
    });
});

describe('burstSchedule', () => {
    it('spreads 24 frames evenly over 1.5 seconds', () => {
        const times = burstSchedule();

        expect(times).toHaveLength(24);
        expect(times[0]).toBe(0);
        expect(times[23]).toBeLessThan(1500);
        expect(times[1]).toBe(63);
    });
});

describe('clip length', () => {
    it('loops the 46-frame sequence three times at 30 fps for about 4.5 seconds', () => {
        expect(clipDurationMs(46)).toBe(4600);
    });
});

describe('pickRecorderMime', () => {
    it('prefers MP4 so iPhones can play and save the clip', () => {
        expect(pickRecorderMime((mime) => mime.startsWith('video/'))).toBe('video/mp4;codecs=avc1');
    });

    it('falls back to WebM on browsers without MP4 recording', () => {
        expect(pickRecorderMime((mime) => mime.startsWith('video/webm'))).toBe('video/webm;codecs=vp9');
    });

    it('returns null when nothing can be recorded (GIF fallback)', () => {
        expect(pickRecorderMime(() => false)).toBeNull();
    });
});

describe('frame', () => {
    it('is 4:5 with the photo area inside it', () => {
        expect(BOOMERANG_FRAME.w / BOOMERANG_FRAME.h).toBe(0.8);
        expect(BOOMERANG_FRAME.photo.y + BOOMERANG_FRAME.photo.h).toBeLessThanOrEqual(BOOMERANG_FRAME.footer.y);
        expect(BOOMERANG_ASPECT).toBeCloseTo(672 / 744);
    });
});
