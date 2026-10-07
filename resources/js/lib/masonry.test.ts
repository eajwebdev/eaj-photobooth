import { describe, expect, it } from 'vitest';
import { assignColumns, columnsFor } from './masonry';

const item = (key: string, ratio = 1.5) => ({ key, ratio });

describe('assignColumns', () => {
    it('fills the shortest column first', () => {
        const result = assignColumns([item('a', 3), item('b', 1), item('c', 1)], 2, new Map());

        expect([...result.entries()]).toEqual([
            ['a', 0],
            ['b', 1],
            ['c', 1],
        ]);
    });

    it('never moves a photo that already has a column when more load', () => {
        const first = assignColumns([item('a'), item('b'), item('c')], 2, new Map());
        const more = assignColumns([item('a'), item('b'), item('c'), item('d', 0.5), item('e', 3)], 2, first);

        for (const key of ['a', 'b', 'c']) {
            expect(more.get(key)).toBe(first.get(key));
        }
    });

    it('keeps existing photos in place when new ones arrive at the top', () => {
        const first = assignColumns([item('a'), item('b')], 2, new Map());
        const withNew = assignColumns([item('new'), item('a'), item('b')], 2, first);

        expect(withNew.get('a')).toBe(first.get('a'));
        expect(withNew.get('b')).toBe(first.get('b'));
        expect(withNew.has('new')).toBe(true);
    });

    it('reflows when the number of columns shrinks', () => {
        const wide = assignColumns([item('a'), item('b'), item('c'), item('d')], 4, new Map());
        const narrow = assignColumns([item('a'), item('b'), item('c'), item('d')], 2, wide);

        expect(Math.max(...narrow.values())).toBeLessThan(2);
    });
});

describe('columnsFor', () => {
    it.each([
        [375, 2],
        [820, 3],
        [1180, 4],
        [1920, 5],
    ])('gives %ipx wide screens %i columns', (width, columns) => {
        expect(columnsFor(width)).toBe(columns);
    });
});
