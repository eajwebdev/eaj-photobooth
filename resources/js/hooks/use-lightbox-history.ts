import { lightboxUuidFrom, pushLightbox, replaceLightbox, setLightboxHandler } from '@/lib/lightbox-history';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Opens photos in the viewer with their own address (/p/{uuid}): the phone's
 * back button closes the viewer, forward reopens it, and the grid behind is
 * never reloaded.
 */
export function useLightboxHistory(): {
    openUuid: string | null;
    open: (uuid: string) => void;
    move: (uuid: string) => void;
    close: () => void;
} {
    const [openUuid, setOpenUuid] = useState<string | null>(null);
    const isOpen = useRef(false);

    useEffect(() => {
        setLightboxHandler((state) => {
            const uuid = lightboxUuidFrom(state);

            if (uuid) {
                isOpen.current = true;
                setOpenUuid(uuid);

                return true;
            }

            if (isOpen.current) {
                isOpen.current = false;
                setOpenUuid(null);

                return true;
            }

            return false;
        });

        return () => setLightboxHandler(null);
    }, []);

    const open = useCallback((uuid: string) => {
        pushLightbox(uuid);
        isOpen.current = true;
        setOpenUuid(uuid);
    }, []);

    const move = useCallback((uuid: string) => {
        replaceLightbox(uuid);
        setOpenUuid(uuid);
    }, []);

    const close = useCallback(() => {
        if (lightboxUuidFrom(window.history.state)) {
            window.history.back();
        } else {
            isOpen.current = false;
            setOpenUuid(null);
        }
    }, []);

    return { openUuid, open, move, close };
}
