import { ApiError } from '@/lib/api';

export type PinKind = 'admin' | 'keepsake';

const storageKey = (kind: PinKind) => `je.${kind}Pin`;

/** The PIN lives only for this browser tab (sessionStorage), never on disk. */
export function storedPin(kind: PinKind): string | null {
    try {
        return window.sessionStorage.getItem(storageKey(kind));
    } catch {
        return null;
    }
}

export function storePin(kind: PinKind, pin: string | null): void {
    try {
        if (pin) {
            window.sessionStorage.setItem(storageKey(kind), pin);
        } else {
            window.sessionStorage.removeItem(storageKey(kind));
        }
    } catch {
        // Asked again next time.
    }
}

/**
 * Calls a PIN-protected endpoint (/api/admin/… or /api/keepsake/…). A 401
 * means the PIN changed or expired: the caller locks the screen again.
 */
export async function pinFetch<T>(kind: PinKind, path: string, init: RequestInit = {}): Promise<T> {
    const pin = storedPin(kind) ?? '';
    const header = kind === 'admin' ? 'X-Admin-Pin' : 'X-Keepsake-Pin';
    let response: Response;

    try {
        response = await fetch(`/api/${kind}${path}`, {
            ...init,
            headers: {
                Accept: 'application/json',
                ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
                [header]: pin,
                ...init.headers,
            },
        });
    } catch {
        throw new ApiError('No connection right now. Check the Wi-Fi and try again.', 0);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const body = (await response.json().catch(() => null)) as (T & { message?: string; errors?: Record<string, string[]> }) | null;

    if (!response.ok) {
        const firstError = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
        throw new ApiError(firstError ?? body?.message ?? 'Something went wrong. Please try again.', response.status);
    }

    return body as T;
}

export interface ExportStatus {
    uuid: string;
    kind: 'archive' | 'guestbook';
    status: 'pending' | 'ready' | 'failed';
    error: string | null;
    download_url: string | null;
}
