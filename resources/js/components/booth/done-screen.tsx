import { AlbumQr } from '@/components/chapel/album-qr';
import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { useIdle } from '@/hooks/use-idle';
import { useObjectUrls } from '@/hooks/use-object-urls';
import { useUploadQueue } from '@/hooks/use-upload-queue';
import { albumUrl, type AlbumSession } from '@/lib/album-session';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo } from 'react';

export const DONE_IDLE_MS = 90_000;

interface DoneScreenProps {
    /** The finished collage, or the boomerang clip (played on a silent loop). */
    preview: Blob;
    /** client_uuid of the capture just saved, to follow its upload. */
    captureId: string;
    guestName: string;
    album: AlbumSession | null;
    onMore: () => void;
    onDone: () => void;
}

/**
 * After saving: the photo, the album QR and code, and what to do next. Left
 * alone for 90 seconds (a gold line counts down), it closes the album and
 * returns to the welcome screen.
 */
export function DoneScreen({ preview, captureId, guestName, album, onMore, onDone }: DoneScreenProps) {
    const { photobooth } = usePage<SharedData>().props;
    const reduceMotion = useReducedMotion();
    const queue = useUploadQueue();
    const { isIdle, activity } = useIdle(DONE_IDLE_MS);
    const [url] = useObjectUrls(useMemo(() => [preview], [preview]));
    const name = guestName.trim();

    useEffect(() => {
        if (isIdle) {
            onDone();
        }
    }, [isIdle, onDone]);

    const item = queue.items.find((candidate) => candidate.id === captureId);
    const progress = queue.progress[captureId];
    const status = !item
        ? { tone: 'done', text: 'It is in the gallery now.' }
        : item.state === 'failed'
          ? { tone: 'failed', text: `This one could not be uploaded: ${item.error ?? 'please tell the staff.'}` }
          : item.state === 'uploading'
            ? { tone: 'busy', text: progress !== undefined ? `Sending to the gallery… ${Math.round(progress * 100)}%` : 'Sending to the gallery…' }
            : { tone: 'waiting', text: 'Saved on this booth. It goes to the gallery as soon as the Wi-Fi is back.' };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col items-center gap-6 overflow-y-auto pt-2 pb-8 text-center landscape:flex-row landscape:justify-center landscape:gap-12 landscape:overflow-hidden landscape:pb-4">
            {url && (
                <motion.div
                    className="shrink-0 shadow-[0_18px_40px_rgb(0_0_0/0.45)]"
                    initial={reduceMotion ? false : { scale: 0.94, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    {preview.type.startsWith('video/') ? (
                        <video
                            src={url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            aria-label="Your boomerang"
                            className="block max-h-[30dvh] w-auto max-w-[70vw] landscape:max-h-[calc(100dvh-7rem)] landscape:max-w-[38vw]"
                        />
                    ) : (
                        <img
                            src={url}
                            alt="Your photo"
                            data-saveable
                            className="block max-h-[30dvh] w-auto max-w-[70vw] landscape:max-h-[calc(100dvh-7rem)] landscape:max-w-[38vw]"
                        />
                    )}
                </motion.div>
            )}

            <div className="flex max-w-md flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                    <h1 className="font-display text-gold-light relative overflow-hidden px-2 text-[clamp(1.9rem,5.5vw,2.8rem)] leading-tight italic">
                        {status.tone === 'waiting' ? 'Saved safely' : 'Saved to the gallery'}
                        {!reduceMotion && (
                            <motion.span
                                aria-hidden="true"
                                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                                initial={{ left: '-40%' }}
                                animate={{ left: '120%' }}
                                transition={{ duration: 1.1, delay: 0.4, ease: 'easeInOut' }}
                            />
                        )}
                    </h1>
                    <p className="text-mist/85">{name ? `Thank you, ${name}!` : 'Thank you!'}</p>
                    <p
                        aria-live="polite"
                        className={
                            status.tone === 'failed'
                                ? 'text-sm text-[#f0b3aa]'
                                : status.tone === 'done'
                                  ? 'text-gold-light text-sm'
                                  : 'text-mist/70 text-sm'
                        }
                    >
                        {status.text}
                    </p>
                </div>

                <GoldOrnament width="w-10" />

                {album?.code ? (
                    <>
                        <AlbumQr url={albumUrl(photobooth.share_url, album.code)} label={`QR code for album ${album.code}`} />
                        <p className="text-mist/80 text-sm">Scan to see and download all your photos</p>
                        <p className="text-mist">
                            Your album: <span className="font-display text-gold-light text-2xl tracking-wide">{album.code}</span>
                        </p>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="border-gold-light/40 flex aspect-[4/5] w-[min(50vw,11rem)] animate-pulse items-center justify-center rounded-t-[999px] rounded-b-2xl border-2 bg-white/5" />
                        <p className="text-mist/80 text-sm">Getting your album ready…</p>
                    </div>
                )}

                <div className="mt-2 flex w-full flex-col gap-3">
                    <GoldButton size="lg" onClick={onMore}>
                        Take more photos
                    </GoldButton>
                    <GhostButton onClick={onDone}>I’m done</GhostButton>
                </div>
            </div>

            {/* The visible countdown back to the welcome screen. */}
            <span aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[3px] overflow-hidden">
                <span
                    key={activity}
                    className="bg-gold block h-full origin-left"
                    style={{ animation: reduceMotion ? undefined : `je-idle-countdown ${DONE_IDLE_MS}ms linear forwards` }}
                />
            </span>
        </div>
    );
}
