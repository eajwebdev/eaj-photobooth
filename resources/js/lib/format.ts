/**
 * "2026-12-12" → "Saturday, December 12, 2026". Parsed as a calendar date so
 * the day never shifts with the device's time zone.
 */
export function formatWeddingDate(isoDate: string | null, options: Intl.DateTimeFormatOptions = {}): string | null {
    if (!isoDate) {
        return null;
    }

    const [year, month, day] = isoDate.split('-').map(Number);

    if (!year || !month || !day) {
        return null;
    }

    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
        ...options,
    }).format(new Date(Date.UTC(year, month - 1, day)));
}
