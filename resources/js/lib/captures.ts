/** A capture as served by CaptureResource. */
export interface CaptureData {
    id: number;
    uuid: string;
    type: 'collage' | 'boomerang';
    album: string | null;
    mime: string;
    width: number | null;
    height: number | null;
    guest_name: string | null;
    message: string | null;
    dominant_color: string | null;
    created_at?: string;
    is_couple_favourite?: boolean;
    is_hidden?: boolean;
    hearts_count?: number;
    group_tag?: string | null;
    table_no?: number | null;
    challenge_id?: number | null;
    station?: string | null;
    urls: { media: string; poster: string | null; thumb: string; preview: string; page: string; download: string };
}

/** The friendly file name the server also uses, e.g. "Edwin-Jochel-Wedding-0041.jpg". */
export function downloadName(capture: CaptureData, prefix: string): string {
    const extension = capture.urls.media.split('.').pop() ?? 'jpg';

    return `${prefix}-${String(capture.id).padStart(4, '0')}.${extension}`;
}
