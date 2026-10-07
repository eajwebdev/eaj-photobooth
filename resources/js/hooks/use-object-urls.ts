import { useEffect, useMemo, useRef } from 'react';

/**
 * Object URLs for a list of Blobs, created once per Blob and revoked as soon as
 * a Blob leaves the list, so an eight-hour event never leaks memory.
 */
export function useObjectUrls(blobs: (Blob | null)[]): (string | null)[] {
    const cache = useRef(new Map<Blob, string>());

    const urls = useMemo(
        () =>
            blobs.map((blob) => {
                if (!blob) {
                    return null;
                }

                let url = cache.current.get(blob);

                if (!url) {
                    url = URL.createObjectURL(blob);
                    cache.current.set(blob, url);
                }

                return url;
            }),
        [blobs],
    );

    useEffect(() => {
        const live = new Set(blobs);

        for (const [blob, url] of cache.current) {
            if (!live.has(blob)) {
                URL.revokeObjectURL(url);
                cache.current.delete(blob);
            }
        }
    }, [blobs]);

    useEffect(() => {
        const entries = cache.current;

        return () => {
            entries.forEach((url) => URL.revokeObjectURL(url));
            entries.clear();
        };
    }, []);

    return urls;
}
