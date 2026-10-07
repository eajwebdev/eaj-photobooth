import { applyLookToPixels, lookFor } from '@/lib/looks';
import type { LookSlug } from '@/types';

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const ROWS_PER_CHUNK = 64;

let worker: Worker | null = null;
let workerBroken = false;
let nextJobId = 1;
const pending = new Map<number, { resolve: (buffer: ArrayBuffer) => void; reject: () => void }>();

function lookWorker(): Worker | null {
    if (workerBroken || typeof Worker === 'undefined') {
        return null;
    }

    if (!worker) {
        try {
            worker = new Worker(new URL('./look-worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event: MessageEvent<{ id: number; buffer: ArrayBuffer }>) => {
                pending.get(event.data.id)?.resolve(event.data.buffer);
                pending.delete(event.data.id);
            };
            worker.onerror = () => {
                workerBroken = true;
                worker?.terminate();
                worker = null;
                pending.forEach((job) => job.reject());
                pending.clear();
            };
        } catch {
            workerBroken = true;

            return null;
        }
    }

    return worker;
}

/** Sends a copy, so the original pixels survive if the worker fails. */
function processInWorker(target: Worker, image: ImageData, look: LookSlug): Promise<ImageData> {
    return new Promise((resolve, reject) => {
        const id = nextJobId++;
        const buffer = image.data.slice().buffer as ArrayBuffer;

        pending.set(id, {
            resolve: (result) => resolve(new ImageData(new Uint8ClampedArray(result), image.width, image.height)),
            reject: () => reject(new Error('The look worker stopped.')),
        });
        target.postMessage({ id, buffer, width: image.width, height: image.height, look }, [buffer]);
    });
}

async function processInChunks(image: ImageData, look: LookSlug): Promise<ImageData> {
    const definition = lookFor(look);

    for (let row = 0; row < image.height; row += ROWS_PER_CHUNK) {
        applyLookToPixels(image.data, image.width, image.height, definition, row, Math.min(image.height, row + ROWS_PER_CHUNK));
        // Let the browser paint between chunks.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    return image;
}

/**
 * Applies a look to everything drawn on `context` so far. Uses a Web Worker
 * where available, otherwise small chunks on the main thread, so the review
 * screen stays responsive. Never relies on ctx.filter (unreliable on Safari).
 */
export async function applyLook(context: Canvas2D, width: number, height: number, look: LookSlug): Promise<void> {
    const image = context.getImageData(0, 0, width, height);
    const target = lookWorker();
    let result: ImageData;

    try {
        result = target ? await processInWorker(target, image, look) : await processInChunks(image, look);
    } catch {
        result = await processInChunks(image, look);
    }

    context.putImageData(result, 0, 0);
}
