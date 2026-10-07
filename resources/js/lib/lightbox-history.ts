/**
 * Back/forward for the photo viewer.
 *
 * The open photo lives in the address bar as /p/{uuid} (so the back button
 * closes the viewer and the link can be shared). Both history entries keep
 * Inertia's own state; this listener is installed before Inertia starts, so
 * it sees popstate first and stops Inertia from re-mounting the gallery when
 * the guest is only opening or closing a photo.
 */

type Handler = (state: unknown) => boolean;

let handler: Handler | null = null;
let installed = false;

export function installLightboxHistory(): void {
    if (installed || typeof window === 'undefined') {
        return;
    }

    installed = true;

    // Inertia saves scroll positions with replaceState(…, its own page URL). If
    // that lands while a photo is open (e.g. the grid was still gliding when the
    // guest tapped), keep the photo's address and marker instead.
    const replaceState = window.history.replaceState.bind(window.history);
    window.history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
        const open = lightboxUuidFrom(window.history.state);

        if (open && !lightboxUuidFrom(state)) {
            return replaceState({ ...((state as object | null) ?? {}), jeLightbox: open }, unused, `/p/${open}`);
        }

        return replaceState(state, unused, url);
    };

    window.addEventListener('popstate', (event) => {
        if (handler?.(event.state)) {
            event.stopImmediatePropagation();
        }
    });
}

export function setLightboxHandler(next: Handler | null): void {
    handler = next;
}

export function lightboxUuidFrom(state: unknown): string | null {
    if (state && typeof state === 'object' && 'jeLightbox' in state && typeof state.jeLightbox === 'string') {
        return state.jeLightbox;
    }

    return null;
}

export function pushLightbox(uuid: string): void {
    window.history.pushState({ ...(window.history.state ?? {}), jeLightbox: uuid }, '', `/p/${uuid}`);
}

export function replaceLightbox(uuid: string): void {
    window.history.replaceState({ ...(window.history.state ?? {}), jeLightbox: uuid }, '', `/p/${uuid}`);
}
