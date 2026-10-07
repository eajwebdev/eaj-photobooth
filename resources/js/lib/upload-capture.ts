import type { BoomerangClip } from '@/lib/boomerang';
import type { ShotSource } from '@/lib/session-store';
import type { CaptureItem, QueuedFile } from '@/lib/upload-queue';
import type { LookSlug } from '@/types';

export interface CollageUpload {
    clientUuid: string;
    albumClientUuid: string | null;
    layoutSlug: string;
    look: LookSlug;
    collage: Blob;
    shots: Blob[];
    signature: Blob | null;
    guestName: string;
    wish: string;
    camera: ShotSource;
    station: string | null;
    /** Party modules: "Who are you?", table number and the challenge taken. */
    groupTag?: string | null;
    tableNo?: string | null;
    challengeId?: number | null;
}

type NewCaptureItem = Omit<CaptureItem, 'createdAt' | 'attempts' | 'nextAttemptAt' | 'state'>;

/** Adds the party-module fields a guest filled in. */
function partyFields(fields: Record<string, string>, upload: { groupTag?: string | null; tableNo?: string | null; challengeId?: number | null }): void {
    if (upload.groupTag) {
        fields.group_tag = upload.groupTag;
    }

    if (upload.tableNo && /^\d{1,3}$/.test(upload.tableNo) && Number(upload.tableNo) > 0) {
        fields.table_no = upload.tableNo;
    }

    if (upload.challengeId) {
        fields.challenge_id = String(upload.challengeId);
    }
}


/** A collage as an upload-queue item: the fields and files POST /api/captures expects. */
export function collageItem(upload: CollageUpload): NewCaptureItem {
    const fields: Record<string, string> = {
        client_uuid: upload.clientUuid,
        type: 'collage',
        layout: upload.layoutSlug,
        look: upload.look,
        camera: upload.camera,
    };

    if (upload.albumClientUuid) {
        fields.album_client_uuid = upload.albumClientUuid;
    }

    if (upload.guestName.trim()) {
        fields.guest_name = upload.guestName.trim();
    }

    if (upload.wish.trim()) {
        fields.message = upload.wish.trim();
    }

    partyFields(fields, upload);

    const files: QueuedFile[] = [
        { field: 'media', name: 'collage.jpg', blob: upload.collage },
        ...upload.shots.map((blob, index) => ({ field: 'shots[]', name: `shot-${index + 1}.jpg`, blob })),
    ];

    if (upload.signature) {
        files.push({ field: 'signature', name: 'signature.png', blob: upload.signature });
    }

    return {
        kind: 'capture',
        id: upload.clientUuid,
        type: 'collage',
        albumClientUuid: upload.albumClientUuid,
        station: upload.station,
        fields,
        files,
    };
}

export interface BoomerangUpload {
    clientUuid: string;
    albumClientUuid: string | null;
    look: LookSlug;
    clip: BoomerangClip;
    signature: Blob | null;
    guestName: string;
    wish: string;
    camera: ShotSource;
    station: string | null;
    /** Party modules: "Who are you?", table number and the challenge taken. */
    groupTag?: string | null;
    tableNo?: string | null;
    challengeId?: number | null;
}

const CLIP_EXTENSIONS: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'image/gif': 'gif' };

/** A boomerang as an upload-queue item: the clip, its poster JPEG and the guest's details. */
export function boomerangItem(upload: BoomerangUpload): NewCaptureItem {
    const { clip } = upload;
    const fields: Record<string, string> = {
        client_uuid: upload.clientUuid,
        type: 'boomerang',
        look: upload.look,
        camera: upload.camera,
        width: String(clip.width),
        height: String(clip.height),
        duration_ms: String(clip.durationMs),
    };

    if (upload.albumClientUuid) {
        fields.album_client_uuid = upload.albumClientUuid;
    }

    if (upload.guestName.trim()) {
        fields.guest_name = upload.guestName.trim();
    }

    if (upload.wish.trim()) {
        fields.message = upload.wish.trim();
    }

    partyFields(fields, upload);

    const files: QueuedFile[] = [
        { field: 'media', name: `boomerang.${CLIP_EXTENSIONS[clip.mime] ?? 'mp4'}`, blob: clip.clip },
        { field: 'poster', name: 'poster.jpg', blob: clip.poster },
    ];

    if (upload.signature) {
        files.push({ field: 'signature', name: 'signature.png', blob: upload.signature });
    }

    return {
        kind: 'capture',
        id: upload.clientUuid,
        type: 'boomerang',
        albumClientUuid: upload.albumClientUuid,
        station: upload.station,
        fields,
        files,
    };
}
