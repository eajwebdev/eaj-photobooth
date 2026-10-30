const EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
};

/** "Edwin-Jochel-Wedding-Photo-213045.jpg": the prefix, what it is, and the time it was made. */
export function keepsakeFileName(prefix: string, mime: string, now: Date = new Date()): string {
    const type = mime.split(';')[0];
    const kind = type === 'image/jpeg' || type === 'image/png' ? 'Photo' : 'Boomerang';
    const stamp = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, '0')).join('');

    return `${prefix || 'Photobooth'}-${kind}-${stamp}.${EXTENSIONS[type] ?? 'bin'}`;
}

/** True when this browser can hand a file to the share sheet (https only; "Save to Photos" on iPhone). */
export function canShareFile(file: File): boolean {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}
