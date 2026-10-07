import { describe, expect, it } from 'vitest';
import { backoffDelay, isPermanentFailure } from './upload-queue';

describe('backoffDelay', () => {
    it('doubles from 2 seconds', () => {
        expect([1, 2, 3, 4, 5].map(backoffDelay)).toEqual([2000, 4000, 8000, 16000, 32000]);
    });

    it('never waits longer than 60 seconds', () => {
        expect(backoffDelay(6)).toBe(60000);
        expect(backoffDelay(40)).toBe(60000);
    });
});

describe('isPermanentFailure', () => {
    it.each([400, 403, 404, 413, 422])('gives up on %i', (status) => {
        expect(isPermanentFailure(status)).toBe(true);
    });

    it.each([0, 408, 429, 500, 502, 503])('keeps retrying on %i', (status) => {
        expect(isPermanentFailure(status)).toBe(false);
    });
});
