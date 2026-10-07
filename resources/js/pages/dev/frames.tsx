import { LayoutPreview } from '@/components/booth/layout-preview';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { brandFrom } from '@/lib/brand';
import { composeCollage } from '@/lib/compose';
import type { Layout } from '@/lib/layouts';
import { LOOKS } from '@/lib/looks';
import { cn } from '@/lib/utils';
import type { LookSlug, SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const LOOK_SLUGS = Object.keys(LOOKS) as LookSlug[];
const SAMPLE_NAME = 'Tita Baby';
const SAMPLE_WISH = 'May your home always be full of laughter, music and good food. Mahal namin kayo!';

/** A stand-in reception photo: warm bokeh, two guests in barong and Filipiniana. */
async function samplePhoto(width: number, height: number, seed: number): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const hue = (seed * 47) % 360;

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, `hsl(${30 + (hue % 30)} 55% 32%)`);
    background.addColorStop(1, `hsl(${330 + (hue % 40)} 35% 18%)`);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 18; i++) {
        const x = ((seed * 131 + i * 977) % 1000) / 1000;
        const y = ((seed * 71 + i * 613) % 1000) / 1000;
        ctx.fillStyle = `hsla(${40 + ((i * 23) % 40)} 90% 70% / 0.22)`;
        ctx.beginPath();
        ctx.arc(x * width, y * height * 0.6, Math.min(width, height) * (0.03 + (i % 4) * 0.015), 0, Math.PI * 2);
        ctx.fill();
    }

    const size = Math.min(width, height);
    const people = [
        { x: width * 0.38, skin: '#C68642', outfit: '#F4EFE3' },
        { x: width * 0.62, skin: '#E0AC69', outfit: `hsl(${(hue + 320) % 360} 45% 72%)` },
    ];

    for (const person of people) {
        ctx.fillStyle = person.outfit;
        ctx.beginPath();
        ctx.ellipse(person.x, height, size * 0.2, size * 0.32, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = person.skin;
        ctx.beginPath();
        ctx.arc(person.x, height - size * 0.42, size * 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2B1D14';
        ctx.beginPath();
        ctx.arc(person.x, height - size * 0.46, size * 0.115, Math.PI * 1.05, Math.PI * 1.95);
        ctx.fill();
    }

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9));
}

export default function DevFrames({ layouts }: { layouts: Layout[] }) {
    const { photobooth } = usePage<SharedData>().props;
    const brand = useMemo(() => brandFrom(photobooth), [photobooth]);
    const [look, setLook] = useState<LookSlug>('classic');
    const [results, setResults] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;
        const created: string[] = [];

        void (async () => {
            for (const layout of layouts) {
                const shots = await Promise.all(
                    layout.slots.map((slot, index) => samplePhoto(Math.round(slot.w), Math.round(slot.h), index + layout.sort_order)),
                );

                if (cancelled) {
                    return;
                }

                const blob = await composeCollage({ layout, shots, look, brand, guestName: SAMPLE_NAME, wish: SAMPLE_WISH });
                const url = URL.createObjectURL(blob);
                created.push(url);

                if (cancelled) {
                    return;
                }

                setResults((current) => ({ ...current, [`${look}:${layout.slug}`]: url }));
            }
        })();

        return () => {
            cancelled = true;
            created.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [brand, layouts, look]);

    return (
        <RoyalBackground className="min-h-dvh px-4 py-8 sm:px-8">
            <Head title="Frames proof sheet" />
            <div className="mx-auto max-w-[110rem]">
                <h1 className="font-display text-gold-light text-4xl italic">Frames proof sheet</h1>
                <p className="text-mist/70 mt-2 text-sm">
                    Local only. Each frame is composed exactly as it will be saved, using generated sample photos.
                </p>

                <div role="tablist" aria-label="Looks" className="mt-6 flex flex-wrap gap-2">
                    {LOOK_SLUGS.map((slug) => (
                        <button
                            key={slug}
                            type="button"
                            role="tab"
                            aria-selected={look === slug}
                            onClick={() => setLook(slug)}
                            className={cn(
                                'min-h-12 rounded-full px-5',
                                look === slug ? 'bg-gold-light/15 text-gold-light ring-gold/70 ring-1' : 'text-mist/70',
                            )}
                        >
                            {LOOKS[slug].name}
                        </button>
                    ))}
                </div>

                <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-5">
                    {layouts.map((layout) => {
                        const url = results[`${look}:${layout.slug}`];

                        return (
                            <li key={layout.slug} className="flex flex-col gap-2">
                                <div className="bg-navy-2/40 flex aspect-[4/5] items-center justify-center rounded-xl p-3">
                                    {url ? (
                                        <img src={url} alt={layout.name} className="max-h-full max-w-full shadow-xl" data-frame={layout.slug} />
                                    ) : (
                                        <div className="h-full opacity-50">
                                            <LayoutPreview layout={layout} className="h-full w-auto" />
                                        </div>
                                    )}
                                </div>
                                <p className="font-display text-mist">{layout.name}</p>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </RoyalBackground>
    );
}
