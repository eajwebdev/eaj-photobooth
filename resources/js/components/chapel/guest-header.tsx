import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { Monogram } from '@/components/chapel/monogram';
import { formatWeddingDate } from '@/lib/format';
import type { SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';

/** The arch monogram and the couple's names, heading every page guests open on their phones. */
export function GuestHeader() {
    const { photobooth } = usePage<SharedData>().props;
    const date = formatWeddingDate(photobooth.wedding_date, { weekday: undefined });

    return (
        <header className="flex flex-col items-center gap-3 text-center">
            <Link href="/gallery" aria-label="See everyone's photos" className="w-14">
                <Monogram />
            </Link>
            <p className="font-display text-mist text-2xl italic">{photobooth.couple.short}</p>
            {date && <p className="text-gold-light/90 text-xs font-medium tracking-[0.14em]">{date}</p>}
            <GoldOrnament width="w-10" />
        </header>
    );
}
