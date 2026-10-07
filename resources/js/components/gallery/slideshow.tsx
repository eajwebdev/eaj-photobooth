import { AlbumQr } from '@/components/chapel/album-qr';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { Monogram } from '@/components/chapel/monogram';
import { CodeGate } from '@/components/gallery/code-gate';
import { PARTY_SLIDE_MS, PartySlide, type PartySlideKind } from '@/components/gallery/party-slides';
import { useKiosk } from '@/hooks/use-kiosk';
import type { CaptureData } from '@/lib/captures';
import { formatWeddingDate } from '@/lib/format';
import { fetchGallery, GalleryError, rememberGalleryCode } from '@/lib/gallery-api';
import { fetchPartyState, type PartyState } from '@/lib/party';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const SLIDE_MS = 6000;
const POLL_MS = 10_000;
const PAGE_SIZE = 60;
const MAX_POOL = 300;
const CURSOR_HIDE_MS = 3000;
const PARTY_POLL_MS = 15_000;

/**
 * The projector: photos cross-fade every 6 seconds (a boomerang plays its loop
 * once), with the guest's name and wish beside it, and a QR code to the
 * gallery. Brand-new captures jump the queue. Double-click for full screen.
 */
export function Slideshow() {
    const { photobooth } = usePage<SharedData>().props;
    const reduceMotion = useReducedMotion();
    const [pool, setPool] = useState<CaptureData[]>([]);
    const [current, setCurrent] = useState<CaptureData | null>(null);
    const [needsCode, setNeedsCode] = useState(false);
    const [cursorHidden, setCursorHidden] = useState(false);
    const fresh = useRef<CaptureData[]>([]);
    const position = useRef(0);
    const newest = useRef(0);
    const [special, setSpecial] = useState<PartySlideKind | null>(null);
    const party = useRef<PartyState | null>(null);
    const pendingSpecials = useRef<PartySlideKind[]>([]);
    const seenReveals = useRef<{ quiz: string | null; mosaic: string | null } | null>(null);
    const photosShown = useRef(0);
    const date = formatWeddingDate(photobooth.wedding_date, { weekday: undefined });

    useKiosk();

    const load = useCallback(async () => {
        try {
            const page = await fetchGallery({ perPage: PAGE_SIZE });
            setNeedsCode(false);
            setPool(page.data);
            newest.current = page.data[0]?.id ?? 0;
            setCurrent((existing) => existing ?? page.data[0] ?? null);
        } catch (error) {
            if (error instanceof GalleryError && error.kind === 'code') {
                setNeedsCode(true);
            }
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // New captures are shown next, before the slideshow carries on.
    useEffect(() => {
        const timer = window.setInterval(() => {
            fetchGallery({ after: newest.current, perPage: PAGE_SIZE })
                .then((page) => {
                    if (page.data.length === 0) {
                        return;
                    }

                    newest.current = page.data[0].id;
                    fresh.current = [...page.data.reverse(), ...fresh.current];
                    setPool((existing) => [...page.data, ...existing].slice(0, MAX_POOL));
                    setCurrent((existing) => existing ?? page.data[0]);
                })
                .catch(() => undefined);
        }, POLL_MS);

        return () => window.clearInterval(timer);
    }, []);

    const advancePhoto = useCallback(() => {
        const next = fresh.current.shift();

        if (next) {
            setCurrent(next);

            return;
        }

        if (pool.length === 0) {
            return;
        }

        position.current = (position.current + 1) % pool.length;
        setCurrent(pool[position.current]);
    }, [pool]);

    // Party moments: reveals first, then a leaderboard, most-loved or tally slide every few photos.
    const advance = useCallback(() => {
        const reveal = pendingSpecials.current.shift();

        if (reveal) {
            setSpecial(reveal);

            return;
        }

        photosShown.current += 1;
        const count = photosShown.current;
        const state = party.current;
        const next: PartySlideKind | null =
            state === null
                ? null
                : count % 15 === 0 && (state.leaderboard?.top.length ?? 0) > 0
                  ? 'leaderboard'
                  : count % 10 === 0 && state.most_loved.length > 0
                    ? 'loved'
                    : count % 7 === 0 && ((state.tallies?.tables.length ?? 0) > 0 || (state.tallies?.groups.length ?? 0) > 0)
                      ? 'tally'
                      : count % 20 === 0 && state.mosaic
                        ? 'mosaic'
                        : null;

        if (next) {
            setSpecial(next);
        } else {
            advancePhoto();
        }
    }, [advancePhoto]);

    // A party slide stays up for its own time, then the photos carry on.
    useEffect(() => {
        if (!special) {
            return;
        }

        const timer = window.setTimeout(() => {
            setSpecial(null);
            advancePhoto();
        }, PARTY_SLIDE_MS[special]);

        return () => window.clearTimeout(timer);
    }, [advancePhoto, special]);

    // Party state: tallies, most loved, the quiz and the mosaic. New reveals jump the queue.
    useEffect(() => {
        const poll = () =>
            fetchPartyState()
                .then((state) => {
                    party.current = state;
                    const reveals = { quiz: state.quiz_revealed_at, mosaic: state.mosaic?.revealed_at ?? null };

                    if (seenReveals.current) {
                        if (reveals.quiz && reveals.quiz !== seenReveals.current.quiz && state.leaderboard?.top.length) {
                            pendingSpecials.current.push('winner');
                        }

                        if (reveals.mosaic && reveals.mosaic !== seenReveals.current.mosaic) {
                            pendingSpecials.current.unshift('mosaic');
                        }
                    }

                    seenReveals.current = reveals;
                })
                .catch(() => undefined);

        void poll();
        const timer = window.setInterval(poll, PARTY_POLL_MS);

        return () => window.clearInterval(timer);
    }, []);

    // Photos advance on a timer; boomerang videos advance when their loop ends.
    useEffect(() => {
        if (!current || special || current.mime.startsWith('video/')) {
            return;
        }

        const timer = window.setTimeout(advance, SLIDE_MS);

        return () => window.clearTimeout(timer);
    }, [advance, current, special]);

    // Preload the next photo so every cross-fade is instant.
    useEffect(() => {
        const upcoming = fresh.current[0] ?? pool[(position.current + 1) % Math.max(pool.length, 1)];

        if (upcoming && !upcoming.mime.startsWith('video/')) {
            new Image().src = upcoming.urls.preview;
        }
    }, [current, pool]);

    // Hide the mouse pointer on the projector.
    useEffect(() => {
        let timer = window.setTimeout(() => setCursorHidden(true), CURSOR_HIDE_MS);
        const onMove = () => {
            setCursorHidden(false);
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setCursorHidden(true), CURSOR_HIDE_MS);
        };

        window.addEventListener('mousemove', onMove);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('mousemove', onMove);
        };
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void document.documentElement.requestFullscreen?.().catch(() => undefined);
        }
    };

    if (needsCode) {
        return (
            <div className="bg-royal-chapel min-h-dvh px-4 py-8">
                <CodeGate
                    checking={false}
                    rejected={false}
                    onSubmit={(code) => {
                        rememberGalleryCode(code);
                        void load();
                    }}
                />
            </div>
        );
    }

    const galleryUrl = `${photobooth.share_url.replace(/\/+$/, '')}/gallery`;

    return (
        <div
            onDoubleClick={toggleFullscreen}
            className="bg-royal-chapel kiosk grid h-dvh grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27vw)]"
            style={{ cursor: cursorHidden ? 'none' : undefined }}
        >
            <div className="relative min-h-0 p-[3vmin]">
                <AnimatePresence initial={false}>
                    {special && party.current && (
                        <motion.div
                            key={`party-${special}`}
                            className="absolute inset-[3vmin]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2 }}
                        >
                            <PartySlide kind={special} state={party.current} />
                        </motion.div>
                    )}
                    {!special && current && (
                        <motion.div
                            key={current.uuid}
                            className="absolute inset-[3vmin] flex items-center justify-center"
                            initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.015 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.4, ease: 'easeInOut' }}
                        >
                            {current.mime.startsWith('video/') ? (
                                <video
                                    src={current.urls.media}
                                    autoPlay
                                    muted
                                    playsInline
                                    onEnded={advance}
                                    onError={advance}
                                    className="max-h-full max-w-full shadow-[0_30px_80px_rgb(0_0_0/0.55)]"
                                />
                            ) : (
                                <img src={current.urls.preview} alt="" className="max-h-full max-w-full shadow-[0_30px_80px_rgb(0_0_0/0.55)]" />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
                {!current && (
                    <div className="flex h-full items-center justify-center">
                        <p className="font-display text-gold-light text-[4vmin] italic">The first photos are on their way</p>
                    </div>
                )}
            </div>

            <aside className="border-gold-light/15 hidden min-h-0 flex-col items-center justify-between gap-[2vh] border-l px-[2.5vw] py-[5vh] text-center lg:flex">
                <div className="flex flex-col items-center gap-[1.4vh]">
                    <div className="w-[5.5vw] min-w-16">
                        <Monogram />
                    </div>
                    <p className="font-display text-mist text-[clamp(2rem,3vw,3.6rem)] leading-tight italic">{photobooth.couple.short}</p>
                    {date && <p className="text-gold-light text-[clamp(0.9rem,1vw,1.2rem)] font-medium tracking-[0.16em]">{date}</p>}
                    <GoldOrnament width="w-16" />
                </div>

                <AnimatePresence mode="wait">
                    {!special && current && (current.guest_name || current.message) && (
                        <motion.div
                            key={current.uuid}
                            className="flex flex-col items-center gap-[1.5vh]"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            {current.message && (
                                <p className="font-display text-mist line-clamp-6 text-[clamp(1.4rem,1.9vw,2.4rem)] leading-snug italic">
                                    “{current.message}”
                                </p>
                            )}
                            {current.guest_name && <p className="text-gold-light text-[clamp(1rem,1.3vw,1.6rem)]">— {current.guest_name}</p>}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col items-center gap-[1.2vh]">
                    <AlbumQr url={galleryUrl} label="QR code to see all the photos" className="w-[10vw] min-w-36" />
                    <p className="text-mist/85 text-[clamp(0.9rem,1vw,1.2rem)]">See all the photos</p>
                    {photobooth.hashtag && <p className="text-gold-light text-[clamp(0.9rem,1vw,1.2rem)]">{photobooth.hashtag}</p>}
                </div>
            </aside>
        </div>
    );
}
