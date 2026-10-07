import { uuid } from '@/lib/uuid';

const DEVICE_KEY = 'je.deviceId';

/**
 * A random id for this phone (never anything personal). Hearts and the quiz
 * use it to allow one heart per photo and one quiz attempt per phone.
 */
export function deviceId(): string {
    try {
        const existing = window.localStorage.getItem(DEVICE_KEY);

        if (existing) {
            return existing;
        }

        const created = uuid();
        window.localStorage.setItem(DEVICE_KEY, created);

        return created;
    } catch {
        return uuid();
    }
}
