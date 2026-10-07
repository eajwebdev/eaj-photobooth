import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GuestHeader } from '@/components/chapel/guest-header';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { Lightbox } from '@/components/gallery/lightbox';
import { useLightboxHistory } from '@/hooks/use-lightbox-history';
import type { AlbumData } from '@/lib/gallery-api';
import { isIos, rememberAlbum } from '@/lib/my-albums';
import type { SharedData } from '@/types';
import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

const WAITING_POLL_MS = 15_000;

/** A guest's own photos, opened from the booth's QR code. */
export default function AlbumPage({ code, album }: { code: string; album: AlbumData | null }) {
    const { photobooth } = usePage<SharedData>().props;
    const [ios, setIos] = useState(false);
    const captures = album?.captures ?? [];
    const waiting = album === null || captures.length === 0;
    const lightbox = useLightboxHistory();

    // While the booth is still sending, check back quietly.
    const poll = usePoll(WAITING_POLL_MS, { only: ['album'] }, { autoStart: false });

    useEffect(() => {
        if (waiting) {
            poll.start();
        } else {
            poll.stop();
        }

        return () => poll.stop();
    }, [poll, waiting]);

    useEffect(() => {
        setIos(isIos());

        if (album) {
            rememberAlbum(album.code);
        }
    }, [album]);

    const count = captures.length === 1 ? '1 photo' : `${captures.length} photos`;
    const openIndex = captures.findIndex((capture) => capture.uuid === lightbox.openUuid);

    return (
        <RoyalBackground className="px-4 py-8">
            <Head title={`Your photos, album ${code}`} />
            <main className="mx-auto flex max-w-5xl flex-col items-center gap-7">
                <GuestHeader />

                <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="font-display text-gold-light text-[clamp(2.2rem,7vw,3.4rem)] leading-tight italic">Your photos</h1>
                    <p className="text-mist/80">
                        Album <span className="font-display text-gold-light text-xl tracking-wide">{code}</span>
                        {album?.guest_name ? `, ${album.guest_name}` : ''}
                    </p>
                </div>

                {waiting ? (
                    <div className="border-gold-light/20 bg-navy-2/50 flex max-w-md flex-col items-center gap-4 rounded-3xl border p-7 text-center">
                        <p className="text-mist">
                            {album === null ? `Album ${code} is still on its way from the booth.` : 'Your photos are on their way from the booth.'}
                        </p>
                        <p className="text-mist/70 text-sm">
                            This page checks again by itself. You can also come back any time, even after the wedding.
                        </p>
                        <GhostButton type="button" onClick={() => router.reload({ only: ['album'] })}>
                            Check now
                        </GhostButton>
                    </div>
                ) : (
                    <>
                        <div className="flex w-full max-w-sm flex-col items-center gap-3">
                            <p className="text-mist/80 text-center text-sm">
                                {count} in full quality. Tap any photo to see it large and download it.
                            </p>
                            {photobooth.allow_zip_downloads && (
                                <GoldButton asChild size="lg" className="w-full">
                                    <a href={album!.zip_url}>
                                        <Download className="size-5" strokeWidth={1.75} /> Download all
                                    </a>
                                </GoldButton>
                            )}
                            {ios && (
                                <p className="text-mist/70 text-center text-sm">
                                    Tip: open a photo and use Share, then Save Image, to put it in Photos.
                                </p>
                            )}
                        </div>

                        <div className="w-full">
                            <GalleryGrid items={captures} onOpen={(capture) => lightbox.open(capture.uuid)} />
                        </div>
                    </>
                )}

                <AnimatePresence>
                    {openIndex >= 0 && (
                        <Lightbox
                            key="lightbox"
                            items={captures}
                            index={openIndex}
                            onMove={(next) => lightbox.move(captures[next].uuid)}
                            onClose={lightbox.close}
                            showAlbumLink={false}
                        />
                    )}
                </AnimatePresence>

                <Link href="/gallery" className="text-mist/80 decoration-gold/40 inline-flex min-h-12 items-center underline underline-offset-[6px]">
                    See everyone’s photos
                </Link>
            </main>
        </RoyalBackground>
    );
}
