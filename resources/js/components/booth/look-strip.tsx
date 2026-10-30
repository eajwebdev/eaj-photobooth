import { LookLayers } from '@/components/booth/look-layers';
import { LOOK_GROUPS, lookFor, type LookGroup } from '@/lib/looks';
import { cn } from '@/lib/utils';
import type { LookSlug } from '@/types';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

type GroupFilter = LookGroup | 'all';

interface LookStripProps {
    looks: LookSlug[];
    selected: LookSlug;
    onSelect: (look: LookSlug) => void;
    /** The guest's own photo, shown through every look. Without one, a soft colour swatch stands in. */
    sampleUrl?: string | null;
    disabled?: boolean;
    className?: string;
}

/** Scrolls the row so the chosen look sits in the middle, without moving the page around it. */
function useCenterSelected(container: RefObject<HTMLElement | null>, slug: LookSlug, trigger?: string) {
    useEffect(() => {
        const strip = container.current;
        const element = strip?.querySelector<HTMLElement>(`[data-look="${slug}"]`);

        if (!strip || !element) {
            return;
        }

        strip.scrollTo({ left: element.offsetLeft - strip.clientWidth / 2 + element.clientWidth / 2, behavior: 'smooth' });
    }, [container, slug, trigger]);
}

/**
 * The looks as a strip of film frames, each showing the guest's photo through
 * that look, with group chips (Natural, Vintage…) above it. Tap a frame to
 * choose it.
 */
export function LookStrip({ looks, selected, onSelect, sampleUrl = null, disabled = false, className }: LookStripProps) {
    const groups = useMemo(() => {
        const present = new Set(looks.map((slug) => lookFor(slug).group));

        return (Object.keys(LOOK_GROUPS) as LookGroup[]).filter((group) => present.has(group));
    }, [looks]);
    const [group, setGroup] = useState<GroupFilter>('all');
    const shown = group === 'all' ? looks : looks.filter((slug) => lookFor(slug).group === group);
    const stripRef = useRef<HTMLDivElement>(null);

    useCenterSelected(stripRef, selected, group);

    return (
        <div className={cn('flex min-w-0 flex-col gap-3', className)}>
            {groups.length > 1 && (
                <div role="tablist" aria-label="Filter groups" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
                    {(['all', ...groups] as GroupFilter[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="tab"
                            aria-selected={group === option}
                            onClick={() => setGroup(option)}
                            className={cn(
                                'min-h-9 shrink-0 rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-200',
                                group === option ? 'bg-mist text-navy font-medium' : 'text-mist/80 bg-white/8 hover:bg-white/12',
                            )}
                        >
                            {option === 'all' ? 'All' : LOOK_GROUPS[option]}
                        </button>
                    ))}
                </div>
            )}

            {/* The film strip: sprocket holes along both edges, a frame per look. */}
            <div className="film-strip -mx-4 rounded-none py-3 sm:mx-0 sm:rounded-2xl">
                <div
                    ref={stripRef}
                    role="radiogroup"
                    aria-label="Filters"
                    className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none]"
                >
                    {shown.map((slug) => {
                        const look = lookFor(slug);
                        const isSelected = slug === selected;

                        return (
                            <motion.button
                                key={slug}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`${look.name}: ${look.description}`}
                                data-look={slug}
                                disabled={disabled}
                                onClick={() => onSelect(slug)}
                                whileTap={{ scale: 0.94 }}
                                className="flex w-[4.75rem] shrink-0 snap-center flex-col items-center gap-1.5 disabled:opacity-50 sm:w-[5.5rem]"
                            >
                                <span
                                    className={cn(
                                        'relative block aspect-[4/5] w-full overflow-hidden rounded-md transition-[box-shadow,transform] duration-200',
                                        isSelected ? '-translate-y-0.5 shadow-[0_0_0_2px_#0c1c45,0_0_0_4px_#e8d29b]' : 'opacity-90',
                                    )}
                                >
                                    {sampleUrl ? (
                                        <img
                                            src={sampleUrl}
                                            alt=""
                                            draggable={false}
                                            className="absolute inset-0 size-full object-cover"
                                            style={{ filter: look.cssFilter }}
                                        />
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-0 bg-[linear-gradient(160deg,#f0d9b5,#c98f7a_45%,#3a5bb5)]"
                                            style={{ filter: look.cssFilter }}
                                        />
                                    )}
                                    <LookLayers look={look} />
                                </span>
                                <span
                                    className={cn(
                                        'max-w-full truncate text-xs leading-tight',
                                        isSelected ? 'text-gold-light font-medium' : 'text-mist/75',
                                    )}
                                >
                                    {look.name}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

interface LookChipsProps {
    looks: LookSlug[];
    selected: LookSlug;
    onSelect: (look: LookSlug) => void;
    className?: string;
}

/** A slim row of look names over the live camera, like the mode dial of a phone camera. */
export function LookChips({ looks, selected, onSelect, className }: LookChipsProps) {
    const rowRef = useRef<HTMLDivElement>(null);

    useCenterSelected(rowRef, selected);

    return (
        <div
            ref={rowRef}
            role="radiogroup"
            aria-label="Filters"
            className={cn(
                'flex w-full snap-x gap-1.5 overflow-x-auto px-[max(1rem,calc(50%-6rem))] [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] [scrollbar-width:none]',
                className,
            )}
        >
            {looks.map((slug) => {
                const isSelected = slug === selected;

                return (
                    <button
                        key={slug}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-look={slug}
                        onClick={() => onSelect(slug)}
                        className={cn(
                            'min-h-9 shrink-0 snap-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors duration-200',
                            isSelected ? 'bg-gold-leaf text-navy font-medium' : 'text-mist/85 [text-shadow:0_1px_6px_rgb(12_28_69/0.9)]',
                        )}
                    >
                        {lookFor(slug).name}
                    </button>
                );
            })}
        </div>
    );
}
