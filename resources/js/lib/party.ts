import type { CaptureData } from '@/lib/captures';

/** "Who are you?" groups, matching App\Enums\GuestGroup. */
export const GUEST_GROUPS = [
    { value: 'family-groom', label: 'Family of the groom' },
    { value: 'family-bride', label: 'Family of the bride' },
    { value: 'ninong-ninang', label: 'Ninong & Ninang' },
    { value: 'barkada', label: 'Barkada' },
    { value: 'workmates', label: 'Workmates' },
    { value: 'entourage', label: 'Entourage' },
] as const;

export type GuestGroup = (typeof GUEST_GROUPS)[number]['value'];

export function groupLabel(value: string | null | undefined): string | null {
    return GUEST_GROUPS.find((group) => group.value === value)?.label ?? null;
}

export interface Challenge {
    id: number;
    title: string;
    photos: number;
}

export interface PartyState {
    tallies: { tables: { table: number; photos: number }[]; groups: { group: string; label: string; photos: number }[] } | null;
    most_loved: CaptureData[];
    leaderboard: { total: number; top: { name: string; score: number }[] } | null;
    quiz_revealed_at: string | null;
    mosaic: { preview: string; download: string; revealed_at: string } | null;
}

export async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers } });
    const body = (await response.json().catch(() => null)) as (T & { message?: string }) | null;

    if (!response.ok || body === null) {
        throw Object.assign(new Error(body?.message ?? 'Something went wrong. Please try again.'), { status: response.status });
    }

    return body;
}

export const fetchPartyState = () => fetchJson<{ data: PartyState }>('/api/party/state').then((body) => body.data);
export const fetchChallenges = () => fetchJson<{ data: Challenge[] }>('/api/challenges').then((body) => body.data);
