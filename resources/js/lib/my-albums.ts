const MY_ALBUMS_KEY = 'je.myAlbums';

export interface RememberedAlbum {
    code: string;
    savedAt: number;
}

/** Albums this phone has opened, newest first; "My photos" in the gallery lists them. */
export function myAlbums(): RememberedAlbum[] {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(MY_ALBUMS_KEY) ?? '[]');

        return Array.isArray(parsed)
            ? parsed.filter((entry): entry is RememberedAlbum => typeof entry?.code === 'string' && typeof entry?.savedAt === 'number')
            : [];
    } catch {
        return [];
    }
}

export function rememberAlbum(code: string): void {
    try {
        const others = myAlbums().filter((entry) => entry.code !== code);
        window.localStorage.setItem(MY_ALBUMS_KEY, JSON.stringify([{ code, savedAt: Date.now() }, ...others].slice(0, 30)));
    } catch {
        // Private mode: the album simply is not remembered.
    }
}

export function isIos(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
