import { describe, expect, it } from 'vitest';
import { poseDeck } from './poses';

describe('poseDeck', () => {
    it('places one Filipino prompt after every two English ones', () => {
        expect(poseDeck({ en: ['a', 'b', 'c', 'd'], fil: ['x', 'y'] })).toEqual(['a', 'b', 'x', 'c', 'd', 'y']);
    });

    it('uses every prompt exactly once when one list is longer', () => {
        expect(poseDeck({ en: ['a'], fil: ['x', 'y', 'z'] })).toEqual(['a', 'x', 'y', 'z']);
    });
});
