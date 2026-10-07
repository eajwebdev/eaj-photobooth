import { describe, expect, it } from 'vitest';
import { STICKERS, stickerById } from './stickers';

describe('sticker set', () => {
    it('has the 24 curated stickers with unique ids', () => {
        expect(STICKERS).toHaveLength(24);
        expect(new Set(STICKERS.map((sticker) => sticker.id)).size).toBe(24);
    });

    it('includes the Filipino family badges and speech bubbles from the brief', () => {
        for (const label of ['Ninong', 'Ninang', 'Abay', 'Team Groom', 'Team Bride', 'Barkada', 'Lola', 'Tito', 'Tita', 'I do!', 'Kilig!', "Forever na 'to"]) {
            expect(STICKERS.map((sticker) => sticker.label)).toContain(label);
        }
    });

    it('finds a sticker by id', () => {
        expect(stickerById('crown')?.label).toBe('Crown');
        expect(stickerById('nope')).toBeUndefined();
    });
});
