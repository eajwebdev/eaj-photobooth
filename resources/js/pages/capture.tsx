import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GuestHeader } from '@/components/chapel/guest-header';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { downloadName, type CaptureData } from '@/lib/captures';
import { isIos } from '@/lib/my-albums';
import type { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Download, Share } from 'lucide-react';
import { useEffect, useState } from 'react';

/** The share page for one photo or boomerang, opened from the gallery or a shared link. */
export default function CapturePage({ capture }: { capture: CaptureData }) {
    const { photobooth } = usePage<SharedData>().props;
    const [canShareFiles, setCanShareFiles] = useState(false);
    const [ios, setIos] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const isVideo = capture.mime.startsWith('video/');
    const fileName = downloadName(capture, photobooth.download_prefix);

    useEffect(() => {
        setIos(isIos());
        const probe = new File([new Blob()], fileName, { type: capture.mime });
        setCanShareFiles(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }));
    }, [capture.mime, fileName]);

    const share = async () => {
        setShareError(null);

        try {
            const blob = await (await fetch(capture.urls.media)).blob();
            await navigator.share({ files: [new File([blob], fileName, { type: capture.mime })], title: photobooth.couple.short });
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                setShareError('Sharing did not work on this phone. Use Download instead.');
            }
        }
    };

    return (
        <RoyalBackground className="px-4 py-8">
            <Head title={capture.guest_name ? `A photo from ${capture.guest_name}` : 'A photo from the wedding'} />
            <main className="mx-auto flex max-w-xl flex-col items-center gap-7">
                <GuestHeader />

                <figure className="flex w-full flex-col items-center gap-4">
                    <div className="w-full shadow-[0_18px_40px_rgb(0_0_0/0.45)]" style={{ backgroundColor: capture.dominant_color ?? undefined }}>
                        {isVideo ? (
                            <video
                                src={capture.urls.media}
                                poster={capture.urls.poster ?? undefined}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="block h-auto w-full"
                            />
                        ) : (
                            <img
                                src={capture.urls.preview}
                                alt={capture.guest_name ? `Photo from ${capture.guest_name}` : 'Wedding photo'}
                                className="block h-auto w-full"
                            />
                        )}
                    </div>
                    {(capture.guest_name || capture.message) && (
                        <figcaption className="flex flex-col items-center gap-1 text-center">
                            {capture.message && <p className="font-display text-mist text-xl leading-snug italic">“{capture.message}”</p>}
                            {capture.guest_name && <p className="text-gold-light text-sm">— {capture.guest_name}</p>}
                        </figcaption>
                    )}
                </figure>

                <div className="flex w-full max-w-sm flex-col gap-3">
                    <GoldButton asChild size="lg">
                        <a href={capture.urls.download} download={fileName}>
                            <Download className="size-5" strokeWidth={1.75} /> Download
                        </a>
                    </GoldButton>
                    {canShareFiles && (
                        <GhostButton type="button" onClick={() => void share()}>
                            <Share className="size-5" strokeWidth={1.5} /> Save to Photos or share
                        </GhostButton>
                    )}
                    {shareError && (
                        <p role="alert" className="text-center text-sm text-[#f0b3aa]">
                            {shareError}
                        </p>
                    )}
                    {ios && !isVideo && (
                        <p className="text-mist/70 text-center text-sm">On iPhone: press and hold the photo, then tap Save to Photos.</p>
                    )}
                </div>

                <nav className="flex flex-col items-center gap-1">
                    {capture.album && (
                        <Link
                            href={`/a/${capture.album}`}
                            className="text-gold-light decoration-gold/50 inline-flex min-h-12 items-center underline underline-offset-[6px]"
                        >
                            See all photos in album {capture.album}
                        </Link>
                    )}
                    <Link
                        href="/gallery"
                        className="text-mist/80 decoration-gold/40 inline-flex min-h-12 items-center underline underline-offset-[6px]"
                    >
                        See everyone’s photos
                    </Link>
                </nav>
            </main>
        </RoyalBackground>
    );
}
