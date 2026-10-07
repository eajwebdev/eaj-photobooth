import { ExportButton } from '@/components/admin/export-button';
import { FramesPanel } from '@/components/admin/frames-panel';
import { OverviewPanel } from '@/components/admin/overview-panel';
import { PartyPanel } from '@/components/admin/party-panel';
import { PhotosPanel } from '@/components/admin/photos-panel';
import { SettingsPanel } from '@/components/admin/settings-panel';
import { GhostButton } from '@/components/chapel/gold-button';
import { Monogram } from '@/components/chapel/monogram';
import { PinPad } from '@/components/chapel/pin-pad';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { StationSheet } from '@/components/chapel/station-sheet';
import { ApiError } from '@/lib/api';
import { pinFetch, storedPin, storePin } from '@/lib/pin-api';
import { getStation } from '@/lib/station';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

type Tab = 'overview' | 'photos' | 'frames' | 'party' | 'settings' | 'export';

const TABS: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'photos', label: 'Photos' },
    { value: 'frames', label: 'Frames' },
    { value: 'party', label: 'Party' },
    { value: 'settings', label: 'Settings' },
    { value: 'export', label: 'Export' },
];

/** The staff control room, behind the admin PIN. */
export default function AdminControlRoom() {
    const [unlocked, setUnlocked] = useState<boolean | null>(null);
    const [tab, setTab] = useState<Tab>('overview');
    const [station, setStationName] = useState<string | null>(null);
    const [renaming, setRenaming] = useState(false);

    // A PIN entered earlier in this tab is checked again silently.
    useEffect(() => {
        setStationName(getStation());

        if (!storedPin('admin')) {
            setUnlocked(false);

            return;
        }

        pinFetch('admin', '/session', { method: 'POST' })
            .then(() => setUnlocked(true))
            .catch(() => {
                storePin('admin', null);
                setUnlocked(false);
            });
    }, []);

    const lock = useCallback(() => {
        storePin('admin', null);
        setUnlocked(false);
    }, []);

    const checkPin = useCallback(async (pin: string): Promise<string | null> => {
        storePin('admin', pin);

        try {
            await pinFetch('admin', '/session', { method: 'POST' });
            setUnlocked(true);

            return null;
        } catch (error) {
            storePin('admin', null);

            return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
        }
    }, []);

    if (unlocked !== true) {
        return (
            <RoyalBackground className="flex items-center justify-center px-4 py-10">
                <Head title="Control room" />
                {unlocked === false && (
                    <div className="flex flex-col items-center gap-8">
                        <div className="w-20">
                            <Monogram />
                        </div>
                        <PinPad title="Staff only" hint="Enter the admin PIN to open the control room." onSubmit={checkPin} />
                        <Link href="/" className="text-mist/70 inline-flex min-h-12 items-center text-sm underline underline-offset-4">
                            Back to the welcome screen
                        </Link>
                    </div>
                )}
            </RoyalBackground>
        );
    }

    return (
        <RoyalBackground className="pb-16">
            <Head title="Control room" />
            <header className="frosted sticky top-0 z-30 border-x-0 border-t-0">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9">
                            <Monogram />
                        </div>
                        <h1 className="font-display text-gold-light text-2xl italic">Control room</h1>
                    </div>
                    <nav role="tablist" aria-label="Sections" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
                        {TABS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                role="tab"
                                aria-selected={tab === item.value}
                                onClick={() => setTab(item.value)}
                                className={cn(
                                    'min-h-11 shrink-0 rounded-full px-4 text-[0.95rem]',
                                    tab === item.value ? 'bg-gold-light/15 text-gold-light ring-gold/70 ring-1' : 'text-mist/75 hover:text-mist',
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <div className="flex items-center gap-2 text-sm">
                        <button type="button" onClick={() => setRenaming(true)} className="text-mist/75 min-h-11 px-2 underline underline-offset-4">
                            {station ? `This booth: ${station}` : 'Name this booth'}
                        </button>
                        <Link href="/" className="text-mist/75 min-h-11 px-2 leading-[2.75rem] underline underline-offset-4">
                            Welcome screen
                        </Link>
                        <GhostButton type="button" onClick={lock} className="min-h-10 px-4 text-sm">
                            Lock
                        </GhostButton>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
                {tab === 'overview' && <OverviewPanel onLocked={lock} />}
                {tab === 'photos' && <PhotosPanel onLocked={lock} />}
                {tab === 'frames' && <FramesPanel onLocked={lock} />}
                {tab === 'party' && <PartyPanel onLocked={lock} />}
                {tab === 'settings' && <SettingsPanel onLocked={lock} />}
                {tab === 'export' && (
                    <div className="flex max-w-2xl flex-col gap-10">
                        <section className="flex flex-col gap-3">
                            <h2 className="font-display text-gold-light text-2xl italic">Everything, in one ZIP</h2>
                            <p className="text-mist/75">
                                Every collage and boomerang in full quality, the raw photos behind each collage, the guestbook signatures, and a
                                spreadsheet (CSV) of names, wishes and album codes.
                            </p>
                            <ExportButton pinKind="admin" kind="archive" label="Prepare the archive" readyLabel="Download the archive" primary />
                        </section>
                        <section className="flex flex-col gap-3">
                            <h2 className="font-display text-gold-light text-2xl italic">Guestbook PDF</h2>
                            <p className="text-mist/75">
                                An A4 book: a cover, one page per guest with their photo, wish and signature, and the totals.
                            </p>
                            <ExportButton pinKind="admin" kind="guestbook" label="Prepare the guestbook" readyLabel="Download the guestbook PDF" />
                        </section>
                    </div>
                )}
            </main>

            <StationSheet
                open={renaming}
                current={station}
                onSaved={(name) => {
                    setStationName(name);
                    setRenaming(false);
                }}
                onCancel={() => setRenaming(false)}
            />
        </RoyalBackground>
    );
}
