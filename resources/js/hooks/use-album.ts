import { loadAlbum, subscribeAlbum, type AlbumSession } from '@/lib/album-session';
import { useEffect, useState } from 'react';

/** The booth's open guest album; updates when its code arrives from the server. */
export function useAlbum(): AlbumSession | null {
    const [album, setAlbum] = useState<AlbumSession | null>(null);

    useEffect(() => {
        void loadAlbum();

        return subscribeAlbum(setAlbum);
    }, []);

    return album;
}
