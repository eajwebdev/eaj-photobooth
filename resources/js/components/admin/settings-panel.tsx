import { LayoutPreview } from '@/components/booth/layout-preview';
import { GoldButton } from '@/components/chapel/gold-button';
import { Toggle } from '@/components/chapel/toggle';
import { ApiError } from '@/lib/api';
import type { Layout } from '@/lib/layouts';
import { LOOKS } from '@/lib/looks';
import { pinFetch } from '@/lib/pin-api';
import { cn } from '@/lib/utils';
import type { CaptureMode, LookSlug, PartyModule, PhotoboothSettings } from '@/types';
import { router } from '@inertiajs/react';
import { useEffect, useId, useState, type ReactNode } from 'react';

type AdminSettings = PhotoboothSettings & { gallery_code: string | null; has_keepsake_pin: boolean };

const MODULES: { key: PartyModule; label: string; description: string }[] = [
    { key: 'stickers', label: 'Sticker studio', description: 'Guests add stickers to their collage before saving' },
    { key: 'who_are_you', label: 'Who are you?', description: 'Family of the bride, barkada, table number…' },
    { key: 'challenges', label: 'Photo challenges', description: 'A deck of fun photo ideas on the booth' },
    { key: 'hearts', label: 'Hearts', description: 'Guests heart their favourite photos in the gallery' },
    { key: 'quiz', label: 'Couple quiz', description: 'How well do guests know the couple?' },
    { key: 'mosaic', label: 'Grand-finale mosaic', description: 'One big picture made of every photo' },
    { key: 'backdrops', label: 'Virtual backdrops (beta)', description: 'Background replacement on fast devices only' },
];

const inputClass =
    'border-gold-light/30 bg-navy text-mist placeholder:text-mist/35 focus:border-gold h-12 w-full rounded-2xl border px-4 focus:outline-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
    const id = useId();

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-mist/80 text-sm">
                {label}
            </label>
            {children(id)}
            {hint && <p className="text-mist/55 text-xs">{hint}</p>}
        </div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="border-gold-light/20 flex flex-col gap-5 border-t pt-6">
            <h2 className="font-display text-gold-light text-2xl italic">{title}</h2>
            {children}
        </section>
    );
}

/** Every event setting, with a live preview of the collage footer. */
export function SettingsPanel({ onLocked }: { onLocked: () => void }) {
    const [draft, setDraft] = useState<AdminSettings | null>(null);
    const [layouts, setLayouts] = useState<Layout[]>([]);
    const [pins, setPins] = useState({ admin: '', keepsake: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    useEffect(() => {
        pinFetch<{ data: AdminSettings }>('admin', '/settings')
            .then(({ data }) => setDraft(data))
            .catch((caught: ApiError) => (caught.status === 401 ? onLocked() : setMessage({ tone: 'error', text: caught.message })));
        pinFetch<{ data: Layout[] }>('admin', '/layouts')
            .then(({ data }) => setLayouts(data))
            .catch(() => undefined);
    }, [onLocked]);

    if (!draft) {
        return <p className="text-mist/70">{message?.text ?? 'Loading settings…'}</p>;
    }

    const set = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => setDraft({ ...draft, [key]: value });
    const setCouple = (key: keyof PhotoboothSettings['couple'], value: string) => setDraft({ ...draft, couple: { ...draft.couple, [key]: value } });
    const toggleIn = <T,>(list: T[], value: T, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((item) => item !== value));

    const save = async () => {
        setSaving(true);
        setMessage(null);

        const payload: Record<string, unknown> = {
            couple: draft.couple,
            wedding_date: draft.wedding_date || null,
            venue: draft.venue || null,
            hashtag: draft.hashtag || null,
            thank_you_message: draft.thank_you_message || null,
            share_url: draft.share_url,
            download_prefix: draft.download_prefix,
            countdown_seconds: Number(draft.countdown_seconds),
            modes: draft.modes,
            looks: draft.looks,
            default_look: draft.default_look,
            look_picker_enabled: draft.look_picker_enabled,
            sounds_enabled: draft.sounds_enabled,
            front_flash_enabled: draft.front_flash_enabled,
            gallery_access: draft.gallery_access,
            gallery_code: draft.gallery_code || null,
            allow_zip_downloads: draft.allow_zip_downloads,
            after_wedding_mode: draft.after_wedding_mode,
            modules: draft.modules,
            pose_prompts: draft.pose_prompts,
            ...(pins.admin ? { admin_pin: pins.admin } : {}),
            ...(pins.keepsake ? { keepsake_pin: pins.keepsake } : {}),
        };

        try {
            const { data } = await pinFetch<{ data: AdminSettings }>('admin', '/settings', { method: 'PUT', body: JSON.stringify(payload) });
            setDraft(data);
            setPins({ admin: '', keepsake: '' });

            if (pins.admin) {
                // The new admin PIN is needed for the next request.
                window.sessionStorage.setItem('je.adminPin', pins.admin);
            }

            setMessage({ tone: 'ok', text: 'Saved. Every booth picks up the changes on its next screen.' });
            router.reload();
        } catch (caught) {
            setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'The settings were not saved.' });
        } finally {
            setSaving(false);
        }
    };

    const previewLayouts = layouts.filter((layout) => layout.slug === 'classic-portrait' || layout.slug === 'photo-strip-3');

    return (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-8">
                <Section title="The couple">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Groom, full name">
                            {(id) => (
                                <input
                                    id={id}
                                    className={inputClass}
                                    value={draft.couple.groom}
                                    onChange={(e) => setCouple('groom', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Bride, full name">
                            {(id) => (
                                <input
                                    id={id}
                                    className={inputClass}
                                    value={draft.couple.bride}
                                    onChange={(e) => setCouple('bride', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Groom, first name" hint="Printed on every collage">
                            {(id) => (
                                <input
                                    id={id}
                                    className={inputClass}
                                    value={draft.couple.groom_short}
                                    onChange={(e) => setCouple('groom_short', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Bride, first name" hint="Printed on every collage">
                            {(id) => (
                                <input
                                    id={id}
                                    className={inputClass}
                                    value={draft.couple.bride_short}
                                    onChange={(e) => setCouple('bride_short', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Short names" hint="e.g. Edwin & Jochel">
                            {(id) => (
                                <input
                                    id={id}
                                    className={inputClass}
                                    value={draft.couple.short}
                                    onChange={(e) => setCouple('short', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Full names">
                            {(id) => (
                                <input id={id} className={inputClass} value={draft.couple.full} onChange={(e) => setCouple('full', e.target.value)} />
                            )}
                        </Field>
                    </div>
                </Section>

                <Section title="The day">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Wedding date">
                            {(id) => (
                                <input
                                    id={id}
                                    type="date"
                                    className={inputClass}
                                    value={draft.wedding_date ?? ''}
                                    onChange={(e) => set('wedding_date', e.target.value || null)}
                                />
                            )}
                        </Field>
                        <Field label="Venue">
                            {(id) => (
                                <input id={id} className={inputClass} value={draft.venue ?? ''} onChange={(e) => set('venue', e.target.value)} />
                            )}
                        </Field>
                        <Field label="Hashtag">
                            {(id) => (
                                <input id={id} className={inputClass} value={draft.hashtag ?? ''} onChange={(e) => set('hashtag', e.target.value)} />
                            )}
                        </Field>
                        <Field label="Address guests use" hint="Used in every QR code, e.g. https://photos.example.com">
                            {(id) => (
                                <input
                                    id={id}
                                    type="url"
                                    className={inputClass}
                                    value={draft.share_url}
                                    onChange={(e) => set('share_url', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label="Download file names" hint="Letters, numbers and dashes, e.g. Edwin-Jochel-Wedding">
                            {(id) => (
                                <input
                                    id={id}
                                    className={inputClass}
                                    value={draft.download_prefix}
                                    onChange={(e) => set('download_prefix', e.target.value)}
                                />
                            )}
                        </Field>
                    </div>
                    <Field label="Thank-you message" hint="Shown after the wedding and in the guestbook">
                        {(id) => (
                            <textarea
                                id={id}
                                rows={3}
                                className={cn(inputClass, 'h-auto py-3')}
                                value={draft.thank_you_message ?? ''}
                                onChange={(e) => set('thank_you_message', e.target.value)}
                            />
                        )}
                    </Field>
                </Section>

                <Section title="The booth">
                    <Field label="Countdown before each photo (seconds)">
                        {(id) => (
                            <input
                                id={id}
                                type="number"
                                min={2}
                                max={10}
                                className={cn(inputClass, 'w-32')}
                                value={draft.countdown_seconds}
                                onChange={(e) => set('countdown_seconds', Number(e.target.value))}
                            />
                        )}
                    </Field>
                    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        {(['collage', 'boomerang'] as CaptureMode[]).map((mode) => (
                            <Toggle
                                key={mode}
                                label={mode === 'collage' ? 'Photo collages' : 'Boomerangs'}
                                checked={draft.modes.includes(mode)}
                                onChange={(on) =>
                                    set('modes', toggleIn(draft.modes, mode, on).length ? toggleIn(draft.modes, mode, on) : draft.modes)
                                }
                            />
                        ))}
                        <Toggle
                            label="Let guests choose a look"
                            checked={draft.look_picker_enabled}
                            onChange={(on) => set('look_picker_enabled', on)}
                        />
                        <Toggle
                            label="Countdown beeps and shutter sound"
                            checked={draft.sounds_enabled}
                            onChange={(on) => set('sounds_enabled', on)}
                        />
                        <Toggle
                            label="Front flash"
                            description="A white screen lights faces on the front camera"
                            checked={draft.front_flash_enabled}
                            onChange={(on) => set('front_flash_enabled', on)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className="text-mist/80 text-sm">Looks offered, and the one chosen by default</p>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(LOOKS) as LookSlug[]).map((slug) => {
                                const on = draft.looks.includes(slug);

                                return (
                                    <button
                                        key={slug}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => {
                                            const looks = toggleIn(draft.looks, slug, !on);

                                            if (looks.length) {
                                                setDraft({
                                                    ...draft,
                                                    looks,
                                                    default_look: looks.includes(draft.default_look) ? draft.default_look : looks[0],
                                                });
                                            }
                                        }}
                                        className={cn(
                                            'min-h-11 rounded-full border px-4 text-sm',
                                            on ? 'border-gold bg-gold/15 text-gold-light' : 'border-gold-light/25 text-mist/60',
                                        )}
                                    >
                                        {LOOKS[slug].name}
                                    </button>
                                );
                            })}
                        </div>
                        <Field label="Default look">
                            {(id) => (
                                <select
                                    id={id}
                                    className={cn(inputClass, 'w-48')}
                                    value={draft.default_look}
                                    onChange={(e) => set('default_look', e.target.value as LookSlug)}
                                >
                                    {draft.looks.map((slug) => (
                                        <option key={slug} value={slug}>
                                            {LOOKS[slug].name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </Field>
                    </div>
                </Section>

                <Section title="Pose prompts">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {(['en', 'fil'] as const).map((language) => (
                            <Field key={language} label={language === 'en' ? 'English, one per line' : 'Filipino, one per line'}>
                                {(id) => (
                                    <textarea
                                        id={id}
                                        rows={8}
                                        className={cn(inputClass, 'h-auto py-3')}
                                        value={draft.pose_prompts[language].join('\n')}
                                        onChange={(e) =>
                                            set('pose_prompts', {
                                                ...draft.pose_prompts,
                                                [language]: e.target.value.split('\n').map((line) => line.slice(0, 80)),
                                            })
                                        }
                                        onBlur={() =>
                                            set('pose_prompts', {
                                                ...draft.pose_prompts,
                                                [language]: draft.pose_prompts[language].map((line) => line.trim()).filter(Boolean),
                                            })
                                        }
                                    />
                                )}
                            </Field>
                        ))}
                    </div>
                </Section>

                <Section title="Gallery">
                    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        <Toggle
                            label="Ask for a wedding code"
                            description="Off: anyone with the link can see the gallery"
                            checked={draft.gallery_access === 'code'}
                            onChange={(on) => set('gallery_access', on ? 'code' : 'public')}
                        />
                        <Toggle
                            label="Allow “Download all” ZIPs"
                            checked={draft.allow_zip_downloads}
                            onChange={(on) => set('allow_zip_downloads', on)}
                        />
                    </div>
                    {draft.gallery_access === 'code' && (
                        <Field label="Wedding code" hint="Print it on the table cards. Not case-sensitive.">
                            {(id) => (
                                <input
                                    id={id}
                                    className={cn(inputClass, 'sm:w-64')}
                                    value={draft.gallery_code ?? ''}
                                    onChange={(e) => set('gallery_code', e.target.value)}
                                />
                            )}
                        </Field>
                    )}
                </Section>

                <Section title="Party extras">
                    <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                        {MODULES.map((module) => (
                            <Toggle
                                key={module.key}
                                label={module.label}
                                description={module.description}
                                checked={draft.modules[module.key]}
                                onChange={(on) => set('modules', { ...draft.modules, [module.key]: on })}
                            />
                        ))}
                    </div>
                </Section>

                <Section title="After the wedding">
                    <Toggle
                        label="After-wedding mode"
                        description="Closes the booth; the home page becomes your thank-you. The gallery and albums stay open."
                        checked={draft.after_wedding_mode}
                        onChange={(on) => set('after_wedding_mode', on)}
                    />
                </Section>

                <Section title="PINs">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="New admin PIN" hint="4 to 8 digits. Leave empty to keep the current one.">
                            {(id) => (
                                <input
                                    id={id}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    className={inputClass}
                                    value={pins.admin}
                                    onChange={(e) => setPins({ ...pins, admin: e.target.value.replace(/\D/g, '') })}
                                />
                            )}
                        </Field>
                        <Field
                            label="New keepsake PIN (for the couple)"
                            hint={draft.has_keepsake_pin ? 'Set. Leave empty to keep it.' : 'Not set yet: the couple cannot open the keepsake.'}
                        >
                            {(id) => (
                                <input
                                    id={id}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    className={inputClass}
                                    value={pins.keepsake}
                                    onChange={(e) => setPins({ ...pins, keepsake: e.target.value.replace(/\D/g, '') })}
                                />
                            )}
                        </Field>
                    </div>
                </Section>
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
                <p className="text-mist/70 text-sm">How the names, date and hashtag print</p>
                <div className="grid grid-cols-[2fr_1fr] items-end gap-3">
                    {previewLayouts.map((layout) => (
                        <LayoutPreview key={layout.slug} layout={layout} settings={draft} />
                    ))}
                </div>
                {message && (
                    <p
                        role={message.tone === 'error' ? 'alert' : 'status'}
                        className={cn('text-sm', message.tone === 'error' ? 'text-[#f0b3aa]' : 'text-gold-light')}
                    >
                        {message.text}
                    </p>
                )}
                <GoldButton type="button" size="lg" onClick={() => void save()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save settings'}
                </GoldButton>
            </aside>
        </div>
    );
}
