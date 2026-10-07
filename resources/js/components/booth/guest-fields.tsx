import { SignatureSheet } from '@/components/booth/signature-sheet';
import { GhostButton } from '@/components/chapel/gold-button';
import { useObjectUrls } from '@/hooks/use-object-urls';
import { GUEST_GROUPS } from '@/lib/party';
import type { StickerPlacement } from '@/lib/stickers';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { PenLine } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

const WISH_MAX = 280;
const NAME_MAX = 80;

export interface GuestDetails {
    guestName: string;
    wish: string;
    signature: Blob | null;
    /** "Who are you?" (party module), e.g. "barkada". */
    groupTag?: string | null;
    tableNo?: string;
    /** Stickers placed on a collage (party module). */
    stickers?: StickerPlacement[];
}

interface GuestFieldsProps {
    details: GuestDetails;
    onChange: (details: GuestDetails) => void;
    /** Lets the parent focus the wish box (the wish card asks for one). */
    wishInputId?: string;
}

/** Name, wish and guestbook signature: all optional, shared by every review screen. */
export function GuestFields({ details, onChange, wishInputId }: GuestFieldsProps) {
    const { photobooth } = usePage<SharedData>().props;
    const nameId = useId();
    const fallbackWishId = useId();
    const wishId = wishInputId ?? fallbackWishId;
    const [signing, setSigning] = useState(false);
    const [signatureUrl] = useObjectUrls(useMemo(() => [details.signature], [details.signature]));

    const update = (patch: Partial<GuestDetails>) => onChange({ ...details, ...patch });

    return (
        <>
            <label htmlFor={nameId} className="flex flex-col gap-2">
                <span className="text-mist/80 text-sm">Your name (optional)</span>
                <input
                    id={nameId}
                    value={details.guestName}
                    maxLength={NAME_MAX}
                    autoComplete="off"
                    onChange={(event) => update({ guestName: event.target.value })}
                    placeholder="So the couple knows it was you"
                    className="border-gold-light/30 bg-navy text-mist placeholder:text-mist/35 focus:border-gold h-14 rounded-2xl border px-5 focus:outline-none"
                />
            </label>

            <label htmlFor={wishId} className="flex flex-col gap-2">
                <span className="text-mist/80 flex justify-between text-sm">
                    <span>A wish for the couple (optional)</span>
                    <span className="text-mist/50" aria-hidden="true">
                        {details.wish.length}/{WISH_MAX}
                    </span>
                </span>
                <textarea
                    id={wishId}
                    value={details.wish}
                    maxLength={WISH_MAX}
                    rows={3}
                    onChange={(event) => update({ wish: event.target.value })}
                    placeholder={`Write a few words for ${photobooth.couple.short}`}
                    className="border-gold-light/30 bg-navy text-mist placeholder:text-mist/35 focus:border-gold resize-none rounded-2xl border px-5 py-4 leading-relaxed focus:outline-none"
                />
            </label>

            {photobooth.modules.who_are_you && (
                <fieldset className="flex flex-col gap-2">
                    <legend className="text-mist/80 mb-2 text-sm">Who are you? (optional)</legend>
                    <div className="flex flex-wrap gap-2">
                        {GUEST_GROUPS.map((group) => (
                            <button
                                key={group.value}
                                type="button"
                                aria-pressed={details.groupTag === group.value}
                                onClick={() => update({ groupTag: details.groupTag === group.value ? null : group.value })}
                                className={cn(
                                    'min-h-11 rounded-full border px-4 text-sm',
                                    details.groupTag === group.value ? 'border-gold bg-gold/15 text-gold-light' : 'border-gold-light/25 text-mist/80',
                                )}
                            >
                                {group.label}
                            </button>
                        ))}
                    </div>
                    <label className="mt-2 flex items-center gap-3">
                        <span className="text-mist/80 text-sm">Table number</span>
                        <input
                            inputMode="numeric"
                            value={details.tableNo ?? ''}
                            onChange={(event) => update({ tableNo: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                            className="border-gold-light/30 bg-navy text-mist focus:border-gold h-12 w-24 rounded-2xl border px-4 text-center focus:outline-none"
                        />
                    </label>
                </fieldset>
            )}

            {details.signature ? (
                <div className="flex items-center gap-4 rounded-2xl bg-white p-3">
                    <img src={signatureUrl ?? undefined} alt="Your signature" className="h-16 flex-1 object-contain" />
                    <button type="button" onClick={() => setSigning(true)} className="text-royal min-h-12 px-3 text-sm underline">
                        Sign again
                    </button>
                    <button type="button" onClick={() => update({ signature: null })} className="text-royal min-h-12 px-3 text-sm underline">
                        Remove
                    </button>
                </div>
            ) : (
                <GhostButton type="button" onClick={() => setSigning(true)}>
                    <PenLine className="size-5" strokeWidth={1.5} /> Sign the guestbook (optional)
                </GhostButton>
            )}

            <SignatureSheet
                open={signing}
                onClose={() => setSigning(false)}
                onDone={(signature) => {
                    update({ signature });
                    setSigning(false);
                }}
            />
        </>
    );
}
