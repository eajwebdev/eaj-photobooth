import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { setStation, STATION_PRESETS } from '@/lib/station';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

interface StationSheetProps {
    open: boolean;
    current?: string | null;
    onSaved: (name: string) => void;
    onCancel?: () => void;
}

/**
 * Asked once per device: which booth is this? The name travels with every
 * upload so the control room can tell the main booth from a roaming phone.
 */
export function StationSheet({ open, current = null, onSaved, onCancel }: StationSheetProps) {
    const [name, setName] = useState(current ?? '');
    const inputRef = useRef<HTMLInputElement>(null);
    const titleId = useId();

    useEffect(() => {
        if (open) {
            setName(current ?? '');
        }
    }, [open, current]);

    const save = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = name.trim();

        if (trimmed === '') {
            inputRef.current?.focus();

            return;
        }

        setStation(trimmed);
        onSaved(trimmed);
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="bg-navy/70 fixed inset-0 z-50 flex items-end justify-center p-4 backdrop-blur-sm sm:items-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <motion.form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        onSubmit={save}
                        className="border-gold-light/25 bg-navy-2 w-full max-w-md rounded-[1.75rem] border px-6 pt-8 pb-6 shadow-2xl shadow-black/40 sm:px-9"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    >
                        <div className="flex flex-col items-center gap-3 text-center">
                            <h2 id={titleId} className="font-display text-gold-light text-3xl italic">
                                Name this booth
                            </h2>
                            <GoldOrnament width="w-10" />
                            <p className="text-mist/75 max-w-[30ch] text-sm leading-relaxed">
                                For staff. Each photo is labelled with this name, so you can tell the booths apart later.
                            </p>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            {STATION_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setName(preset)}
                                    aria-pressed={name === preset}
                                    className={cn(
                                        'min-h-12 rounded-full border px-5 text-sm transition-colors duration-150',
                                        name === preset
                                            ? 'border-gold bg-gold/15 text-gold-light'
                                            : 'border-gold-light/25 text-mist/85 hover:border-gold-light/50',
                                    )}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        <label className="mt-5 block">
                            <span className="text-mist/75 mb-2 block text-sm">Or type a name</span>
                            <input
                                ref={inputRef}
                                value={name}
                                maxLength={40}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="e.g. Garden booth"
                                className="border-gold-light/30 bg-navy text-mist placeholder:text-mist/35 focus:border-gold h-14 w-full rounded-2xl border px-5 text-base focus:outline-none"
                            />
                        </label>

                        <div className="mt-7 flex flex-col gap-3">
                            <GoldButton type="submit">Save booth name</GoldButton>
                            {onCancel && (
                                <GhostButton type="button" onClick={onCancel}>
                                    Not now
                                </GhostButton>
                            )}
                        </div>
                    </motion.form>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
