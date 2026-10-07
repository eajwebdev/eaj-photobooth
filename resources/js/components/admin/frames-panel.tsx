import { LayoutPreview } from '@/components/booth/layout-preview';
import { Toggle } from '@/components/chapel/toggle';
import { ApiError } from '@/lib/api';
import { LAYOUT_CATEGORIES, shotsLabel, type Layout } from '@/lib/layouts';
import { pinFetch } from '@/lib/pin-api';
import { useEffect, useState } from 'react';

/** Switch frames on or off for the booth. At least one must stay on. */
export function FramesPanel({ onLocked }: { onLocked: () => void }) {
    const [layouts, setLayouts] = useState<Layout[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        pinFetch<{ data: Layout[] }>('admin', '/layouts')
            .then(({ data }) => setLayouts(data))
            .catch((caught: ApiError) => (caught.status === 401 ? onLocked() : setError(caught.message)));
    }, [onLocked]);

    const toggle = async (layout: Layout, isActive: boolean) => {
        if (!isActive && layouts?.filter((item) => item.is_active).length === 1) {
            setError('Keep at least one frame switched on, or the booth has nothing to offer.');

            return;
        }

        setError(null);
        setLayouts((current) => current?.map((item) => (item.slug === layout.slug ? { ...item, is_active: isActive } : item)) ?? null);

        try {
            await pinFetch('admin', `/layouts/${layout.slug}`, { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) });
        } catch (caught) {
            setError(caught instanceof ApiError ? caught.message : 'That change was not saved.');
            setLayouts((current) => current?.map((item) => (item.slug === layout.slug ? { ...item, is_active: !isActive } : item)) ?? null);
        }
    };

    if (!layouts) {
        return <p className="text-mist/70">{error ?? 'Loading frames…'}</p>;
    }

    return (
        <div className="flex flex-col gap-8">
            {error && (
                <p role="alert" className="text-sm text-[#f0b3aa]">
                    {error}
                </p>
            )}
            {LAYOUT_CATEGORIES.filter((category) => category.value !== 'all').map((category) => (
                <section key={category.value} className="flex flex-col gap-4">
                    <h2 className="font-display text-gold-light text-2xl italic">{category.label}</h2>
                    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                        {layouts
                            .filter((layout) => layout.category === category.value)
                            .map((layout) => (
                                <li key={layout.slug} className="flex flex-col gap-2">
                                    <div className={layout.is_active ? '' : 'opacity-40 grayscale'}>
                                        <div className="bg-navy-2/40 flex aspect-[4/5] items-center justify-center rounded-xl p-[8%]">
                                            <LayoutPreview layout={layout} className="h-full max-h-full w-auto max-w-full" />
                                        </div>
                                    </div>
                                    <Toggle
                                        checked={layout.is_active}
                                        onChange={(checked) => void toggle(layout, checked)}
                                        label={layout.name}
                                        description={shotsLabel(layout.shots)}
                                    />
                                </li>
                            ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
