const STATION_KEY = 'je.station';

export const STATION_PRESETS = ['Main booth', 'Phone booth', 'Roaming phone'] as const;

/** The booth's name on this device, e.g. "Main booth". Null until staff set it. */
export function getStation(): string | null {
    try {
        const value = window.localStorage.getItem(STATION_KEY);

        return value && value.trim() !== '' ? value : null;
    } catch {
        return null;
    }
}

export function setStation(name: string): void {
    try {
        window.localStorage.setItem(STATION_KEY, name.trim().slice(0, 40));
    } catch {
        // Private mode: the name simply is not remembered.
    }
}
