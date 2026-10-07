import { deviceId } from '@/lib/device';
import { useCallback, useSyncExternalStore } from 'react';

const HEARTS_KEY = 'je.hearts';

let hearted: Set<string> | null = null;
const listeners = new Set<() => void>();

function load(): Set<string> {
    if (hearted) {
        return hearted;
    }

    try {
        hearted = new Set(JSON.parse(window.localStorage.getItem(HEARTS_KEY) ?? '[]') as string[]);
    } catch {
        hearted = new Set();
    }

    return hearted;
}

function save(next: Set<string>): void {
    hearted = next;

    try {
        window.localStorage.setItem(HEARTS_KEY, JSON.stringify([...next].slice(-2000)));
    } catch {
        // Kept for this visit only.
    }

    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

/** Counts reported back by the server, so every tile showing a photo agrees. */
const counts = new Map<string, number>();

/**
 * Hearts on photos: one per phone per photo, remembered on the phone and
 * counted on the server.
 */
export function useHearts(): {
    isHearted: (uuid: string) => boolean;
    countFor: (uuid: string, fallback: number) => number;
    toggle: (uuid: string) => Promise<void>;
} {
    const snapshot = useSyncExternalStore(subscribe, load, load);

    const toggle = useCallback(async (uuid: string) => {
        const current = load();
        const willHeart = !current.has(uuid);
        const next = new Set(current);

        if (willHeart) {
            next.add(uuid);
        } else {
            next.delete(uuid);
        }

        save(next);

        try {
            const response = await fetch(`/api/captures/${uuid}/heart`, {
                method: willHeart ? 'POST' : 'DELETE',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: deviceId() }),
            });

            if (response.ok) {
                const body = (await response.json()) as { data: { hearts_count: number } };
                counts.set(uuid, body.data.hearts_count);
                listeners.forEach((listener) => listener());
            } else if (response.status !== 429) {
                save(current);
            }
        } catch {
            save(current);
        }
    }, []);

    return {
        isHearted: (uuid) => snapshot.has(uuid),
        countFor: (uuid, fallback) => counts.get(uuid) ?? fallback,
        toggle,
    };
}
