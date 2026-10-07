import { ExportButton } from '@/components/admin/export-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { Monogram } from '@/components/chapel/monogram';
import { PinPad } from '@/components/chapel/pin-pad';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { Lightbox } from '@/components/gallery/lightbox';
import { useLightboxHistory } from '@/hooks/use-lightbox-history';
import { ApiError } from '@/lib/api';
import type { CaptureData } from '@/lib/captures';
import { formatWeddingDate } from '@/lib/format';
import { pinFetch, storedPin, storePin } from '@/lib/pin-api';
import type { SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface GuestbookEntry {
    uuid: string;
    type: 'collage' | 'boomerang';
    guest_name: string | null;
    message: string | null;
    group_tag: string | null;
    table_no: number | null;
    image: string;
    signature: string | null;
    created_at: string;
}

interface Guestbook {
    data: GuestbookEntry[];
    stats: { photos: number; wishes: number; signatures: number };
}

type KeepsakeCapture = CaptureData & { is_couple_favourite?: boolean };

/** The couple's private page after the wedding: every photo, the guestbook, and the downloads. */
export default function Keepsake() {
    const { photobooth } = usePage<SharedData>().props;
    const [unlocked, setUnlocked] = useState<boolean | null>(null);
    const [guestbook, setGuestbook] = useState<Guestbook | null>(null);
    const [captures, setCaptures] = useState<KeepsakeCapture[]>([]);
    const lightbox = useLightboxHistory();
    const date = formatWeddingDate(photobooth.wedding_date, { weekday: undefined });

    const load = useCallback(() => {
        Promise.all([pinFetch<Guestbook>('keepsake', '/guestbook'), pinFetch<{ data: KeepsakeCapture[] }>('keepsake', '/captures')])
            .then(([book, all]) => {
                setGuestbook(book);
                setCaptures(all.data);
                setUnlocked(true);
            })
            .catch(() => {
                storePin('keepsake', null);
                setUnlocked(false);
            });
    }, []);

    useEffect(() => {
        if (storedPin('keepsake')) {
            load();
        } else {
            setUnlocked(false);
        }
    }, [load]);

    const checkPin = useCallback(
        async (pin: string): Promise<string | null> => {
            storePin('keepsake', pin);

            try {
                await pinFetch('keepsake', '/session', { method: 'POST' });
                load();

                return null;
            } catch (error) {
                storePin('keepsake', null);

                return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
            }
        },
        [load],
    );

    const favourites = useMemo(() => captures.filter((capture) => capture.is_couple_favourite), [captures]);
    const openIndex = captures.findIndex((capture) => capture.uuid === lightbox.openUuid);

    if (unlocked !== true) {
        return (
            <RoyalBackground className="flex items-center justify-center px-4 py-10">
                <Head title="Our keepsake" />
                {unlocked === false && (
                    <div className="flex flex-col items-center gap-8">
                        <div className="w-20">
                            <Monogram />
                        </div>
                        <PinPad title="Our keepsake" hint={`For ${photobooth.couple.short}. Enter your keepsake PIN.`} onSubmit={checkPin} />
                    </div>
                )}
            </RoyalBackground>
        );
    }

    return (
        <RoyalBackground className="pb-20">
            <Head title="Our keepsake" />
            <header className="flex flex-col items-center gap-3 px-4 pt-12 pb-8 text-center">
                <div className="w-20">
                    <Monogram draw />
                </div>
                <p className="font-display text-gold-light text-xl italic">Our keepsake</p>
                <h1 className="font-display text-mist text-[clamp(2.4rem,8vw,4rem)] leading-tight italic">{photobooth.couple.short}</h1>
                {date && <p className="text-gold-light text-sm font-medium tracking-[0.14em]">{date}</p>}
                <GoldOrnament width="w-12" className="my-1" />
                {guestbook && (
                    <p className="text-mist/80">
                        {guestbook.stats.photos.toLocaleString()} photos, {guestbook.stats.wishes.toLocaleString()} wishes,{' '}
                        {guestbook.stats.signatures.toLocaleString()} signatures
                    </p>
                )}
            </header>

            <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 sm:px-6">
                <section className="border-gold-light/20 grid gap-8 rounded-3xl border p-6 sm:grid-cols-2 sm:p-8">
                    <div className="flex flex-col gap-3">
                        <h2 className="font-display text-gold-light text-2xl italic">Your guestbook</h2>
                        <p className="text-mist/75">A printable A4 book: one page per guest, with their photo, wish and signature.</p>
                        <ExportButton
                            pinKind="keepsake"
                            kind="guestbook"
                            label="Prepare the guestbook PDF"
                            readyLabel="Download the guestbook PDF"
                            primary
                        />
                    </div>
                    <div className="flex flex-col gap-3">
                        <h2 className="font-display text-gold-light text-2xl italic">Everything</h2>
                        <p className="text-mist/75">Every photo and boomerang in full quality, with the raw photos and a list of names and wishes.</p>
                        <ExportButton pinKind="keepsake" kind="archive" label="Prepare everything (ZIP)" readyLabel="Download everything" />
                    </div>
                </section>

                {favourites.length > 0 && (
                    <section className="flex flex-col gap-5">
                        <h2 className="font-display text-gold-light text-3xl italic">Our favourites</h2>
                        <GalleryGrid items={favourites} onOpen={(capture) => lightbox.open(capture.uuid)} />
                    </section>
                )}

                {guestbook && guestbook.data.length > 0 && (
                    <section className="flex flex-col gap-6">
                        <h2 className="font-display text-gold-light text-3xl italic">The guestbook</h2>
                        <ol className="flex flex-col gap-6">
                            {guestbook.data.map((entry) => (
                                <li
                                    key={entry.uuid}
                                    className="border-gold-light/15 grid gap-5 rounded-2xl border p-4 sm:grid-cols-[12rem_1fr] sm:p-5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => lightbox.open(entry.uuid)}
                                        className="block overflow-hidden rounded-[3px] shadow-[0_10px_24px_rgb(0_0_0/0.35)]"
                                        aria-label={`Open the photo from ${entry.guest_name ?? 'a guest'}`}
                                    >
                                        <img src={entry.image} alt="" loading="lazy" className="w-full" />
                                    </button>
                                    <div className="flex flex-col justify-center gap-3">
                                        {entry.message && <p className="font-display text-mist text-xl leading-snug italic">“{entry.message}”</p>}
                                        <p className="text-gold-light">{entry.guest_name ? `— ${entry.guest_name}` : '— A guest'}</p>
                                        {entry.signature && (
                                            <div className="w-fit rounded-xl bg-white px-4 py-2">
                                                <img
                                                    src={entry.signature}
                                                    alt={`Signature of ${entry.guest_name ?? 'a guest'}`}
                                                    className="h-14 w-auto"
                                                    loading="lazy"
                                                />
                                            </div>
                                        )}
                                        <p className="text-mist/50 text-xs">
                                            {new Date(entry.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            {entry.table_no ? `, table ${entry.table_no}` : ''}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                <section className="flex flex-col gap-5">
                    <h2 className="font-display text-gold-light text-3xl italic">Every photo</h2>
                    <GalleryGrid items={captures} onOpen={(capture) => lightbox.open(capture.uuid)} />
                </section>
            </main>

            <AnimatePresence>
                {openIndex >= 0 && (
                    <Lightbox
                        key="lightbox"
                        items={captures}
                        index={openIndex}
                        onMove={(next) => lightbox.move(captures[next].uuid)}
                        onClose={lightbox.close}
                    />
                )}
            </AnimatePresence>
        </RoyalBackground>
    );
}
