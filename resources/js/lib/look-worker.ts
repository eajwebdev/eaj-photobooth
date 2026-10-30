/// <reference lib="webworker" />
import { applyLookToPixels, lookFor } from '@/lib/looks';
import type { LookSlug } from '@/types';

interface LookJob {
    id: number;
    buffer: ArrayBuffer;
    width: number;
    height: number;
    look: LookSlug;
    seed?: number;
}

/** Applies a look (colour matrix, light leak, vignette and grain) off the main thread. */
self.onmessage = (event: MessageEvent<LookJob>) => {
    const { id, buffer, width, height, look, seed = 0 } = event.data;

    applyLookToPixels(new Uint8ClampedArray(buffer), width, height, lookFor(look), 0, height, seed);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, buffer }, [buffer]);
};
