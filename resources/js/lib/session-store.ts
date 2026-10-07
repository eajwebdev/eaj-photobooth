import type { BoomerangClip } from '@/lib/boomerang';
import type { StickerPlacement } from '@/lib/stickers';
import { uuid } from '@/lib/uuid';
import type { CaptureMode, LookSlug } from '@/types';
import { del, get, set } from 'idb-keyval';

const SESSION_KEY = 'je.boothSession';

/** Sessions older than this are not resumed after a reload. */
const RESUME_WITHIN_MS = 30 * 60 * 1000;

export type ShotSource = 'front' | 'back' | 'upload';

/**
 * The guest group's work in progress, kept in IndexedDB the moment each shot
 * is taken, so a reload or a crash never loses a photo.
 */
export interface BoothSession {
    id: string;
    mode: CaptureMode;
    layoutSlug: string | null;
    look: LookSlug;
    shots: (Blob | null)[];
    camera: ShotSource;
    guestName?: string;
    wish?: string;
    signature?: Blob | null;
    groupTag?: string | null;
    tableNo?: string;
    stickers?: StickerPlacement[];
    /** The photo challenge this group took, if any. */
    challenge?: { id: number; title: string } | null;
    /** Boomerang frame: classic, story or square. */
    boomerangFrame?: string;
    /** A finished boomerang waiting on the review screen. */
    boomerang?: BoomerangClip | null;
    updatedAt: number;
}

export async function loadSession(): Promise<BoothSession | null> {
    try {
        const session = await get<BoothSession>(SESSION_KEY);

        if (!session || Date.now() - session.updatedAt > RESUME_WITHIN_MS) {
            return null;
        }

        return session;
    } catch {
        return null;
    }
}

export async function saveSession(session: BoothSession): Promise<void> {
    try {
        await set(SESSION_KEY, { ...session, updatedAt: Date.now() });
    } catch {
        // Storage full or blocked (private mode): the shot stays in memory only.
    }
}

export async function clearSession(): Promise<void> {
    try {
        await del(SESSION_KEY);
    } catch {
        // Nothing to clear.
    }
}

/** Doubles as the capture's client_uuid, which makes uploads idempotent. */
export function newSessionId(): string {
    return uuid();
}
