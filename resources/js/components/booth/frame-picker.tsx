import { LayoutPreview } from '@/components/booth/layout-preview';
import { LAYOUT_CATEGORIES, shotsLabel, type Layout, type LayoutCategory } from '@/lib/layouts';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

const TAB_KEY = 'je.frameTab';

type Tab = LayoutCategory | 'all';

function rememberedTab(): Tab {
    try {
        const saved = window.sessionStorage.getItem(TAB_KEY);

        return LAYOUT_CATEGORIES.some((category) => category.value === saved) ? (saved as Tab) : 'all';
    } catch {
        return 'all';
    }
}

interface FramePickerProps {
    layouts: Layout[];
    onPick: (layout: Layout) => void;
}

export function framePreviewId(slug: string): string {
    return `frame-preview-${slug}`;
}

/** All active frames as true-to-life miniatures, filterable by category. */
export function FramePicker({ layouts, onPick }: FramePickerProps) {
    const [tab, setTab] = useState<Tab>(rememberedTab);

    const tabs = useMemo(
        () => LAYOUT_CATEGORIES.filter((category) => category.value === 'all' || layouts.some((layout) => layout.category === category.value)),
        [layouts],
    );

    const visible = useMemo(() => (tab === 'all' ? layouts : layouts.filter((layout) => layout.category === tab)), [layouts, tab]);

    const choose = (next: Tab) => {
        setTab(next);

        try {
            window.sessionStorage.setItem(TAB_KEY, next);
        } catch {
            // Not remembered in private mode; harmless.
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {tabs.length > 2 && (
                <div
                    role="tablist"
                    aria-label="Frame styles"
                    className="-mx-4 flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:justify-center"
                >
                    {tabs.map((category) => (
                        <button
                            key={category.value}
                            type="button"
                            role="tab"
                            aria-selected={tab === category.value}
                            onClick={() => choose(category.value)}
                            className={cn(
                                'min-h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-200 sm:min-h-12 sm:px-5 sm:text-base',
                                tab === category.value ? 'bg-mist text-navy font-medium' : 'text-mist/80 bg-white/8 hover:bg-white/12',
                            )}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">
                <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5">
                    {visible.map((layout) => (
                        <li key={layout.slug}>
                            <motion.button
                                type="button"
                                onClick={() => onPick(layout)}
                                whileTap={{ scale: 0.97 }}
                                className="group flex w-full flex-col items-center gap-3 rounded-2xl p-1 text-center"
                                aria-label={`${layout.name}, ${shotsLabel(layout.shots)}`}
                            >
                                <span className="bg-navy-2/40 ring-gold-light/10 group-hover:ring-gold-light/40 relative block aspect-[4/5] w-full overflow-hidden rounded-xl ring-1 transition-colors duration-200">
                                    <motion.span
                                        layoutId={framePreviewId(layout.slug)}
                                        className="absolute inset-[7%] flex items-center justify-center drop-shadow-[0_10px_18px_rgb(0_0_0/0.35)]"
                                    >
                                        <LayoutPreview layout={layout} className="h-full max-h-full w-auto max-w-full" />
                                    </motion.span>
                                </span>
                                <span className="flex flex-col gap-0.5">
                                    <span className="font-display text-mist text-[1.15rem] leading-tight sm:text-xl">{layout.name}</span>
                                    <span className="text-gold-light text-sm">{shotsLabel(layout.shots)}</span>
                                </span>
                            </motion.button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
