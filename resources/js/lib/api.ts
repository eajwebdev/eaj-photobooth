export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

/**
 * JSON fetch for the photobooth API. Errors carry the server's own message
 * (already written for guests), or a plain fallback when offline.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;

    try {
        response = await fetch(path, {
            ...init,
            headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
        });
    } catch {
        throw new ApiError('No connection right now. Check the Wi-Fi and try again.', 0);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            body !== null && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
                ? body.message
                : 'Something went wrong. Please try again.';

        throw new ApiError(message, response.status);
    }

    return body as T;
}
