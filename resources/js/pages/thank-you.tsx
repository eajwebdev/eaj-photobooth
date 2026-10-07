import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { Monogram } from '@/components/chapel/monogram';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { formatWeddingDate } from '@/lib/format';
import { myAlbums } from '@/lib/my-albums';
import type { SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useId, useState, type FormEvent } from 'react';

/**
 * After the wedding the booth closes and the home page becomes the couple's
 * thank-you, leading guests into the gallery and their own albums.
 */
export default function ThankYou() {
    const { photobooth } = usePage<SharedData>().props;
    const date = formatWeddingDate(photobooth.wedding_date, { weekday: undefined });
    const [code, setCode] = useState('');
    const [lastAlbum, setLastAlbum] = useState<string | null>(null);
    const inputId = useId();

    useEffect(() => setLastAlbum(myAlbums()[0]?.code ?? null), []);

    const openAlbum = (event: FormEvent) => {
        event.preventDefault();
        const clean = code.trim().toUpperCase().replace(/\s+/g, '');

        if (/^[A-Z]{2,10}-?\d{4}$/.test(clean)) {
            router.visit(`/a/${clean.includes('-') ? clean : `${clean.slice(0, -4)}-${clean.slice(-4)}`}`);
        }
    };

    return (
        <RoyalBackground className="flex items-center justify-center px-4 py-12">
            <Head title="Thank you" />
            <main className="flex max-w-xl flex-col items-center gap-6 text-center">
                <div className="w-[min(40vw,9rem)]">
                    <Monogram draw />
                </div>
                <p className="font-display text-gold-light text-xl italic">Thank you</p>
                <h1 className="font-display text-mist text-[clamp(2.4rem,9vw,4.2rem)] leading-tight italic">{photobooth.couple.short}</h1>
                {date && <p className="text-gold-light text-sm font-medium tracking-[0.14em]">{date}</p>}
                <GoldOrnament />
                {photobooth.thank_you_message && (
                    <p className="font-display text-mist/90 text-xl leading-relaxed italic">{photobooth.thank_you_message}</p>
                )}

                <div className="mt-2 flex w-full max-w-sm flex-col gap-3">
                    <GoldButton asChild size="lg">
                        <Link href="/gallery">See all the photos</Link>
                    </GoldButton>
                    {lastAlbum && (
                        <GhostButton asChild>
                            <Link href={`/a/${lastAlbum}`}>Open my album, {lastAlbum}</Link>
                        </GhostButton>
                    )}
                </div>

                <form onSubmit={openAlbum} className="mt-4 flex w-full max-w-sm flex-col gap-2">
                    <label htmlFor={inputId} className="text-mist/75 text-sm">
                        Have an album code from the booth? It looks like <span className="whitespace-nowrap">ROSE-4821</span>.
                    </label>
                    <div className="flex gap-2">
                        <input
                            id={inputId}
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                            autoCapitalize="characters"
                            autoComplete="off"
                            placeholder="Album code"
                            className="border-gold-light/35 bg-navy text-mist placeholder:text-mist/35 focus:border-gold h-12 min-w-0 flex-1 rounded-full border px-5 tracking-wide focus:outline-none"
                        />
                        <GhostButton type="submit">Open</GhostButton>
                    </div>
                </form>
            </main>
        </RoyalBackground>
    );
}
