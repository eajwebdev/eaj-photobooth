import { describe, expect, it } from 'vitest';
import { keepsakeFileName } from './download';

const evening = new Date(2026, 11, 12, 21, 5, 9);

describe('keepsakeFileName', () => {
    it('names a collage as a photo with the time it was made', () => {
        expect(keepsakeFileName('Edwin-Jochel-Wedding', 'image/jpeg', evening)).toBe('Edwin-Jochel-Wedding-Photo-210509.jpg');
    });

    it('names a boomerang by its clip format', () => {
        expect(keepsakeFileName('Edwin-Jochel-Wedding', 'video/mp4', evening)).toBe('Edwin-Jochel-Wedding-Boomerang-210509.mp4');
        expect(keepsakeFileName('Edwin-Jochel-Wedding', 'video/webm;codecs=vp9', evening)).toBe('Edwin-Jochel-Wedding-Boomerang-210509.webm');
        expect(keepsakeFileName('Edwin-Jochel-Wedding', 'image/gif', evening)).toBe('Edwin-Jochel-Wedding-Boomerang-210509.gif');
    });

    it('falls back to a plain prefix when none is set', () => {
        expect(keepsakeFileName('', 'image/jpeg', evening)).toBe('Photobooth-Photo-210509.jpg');
    });
});
