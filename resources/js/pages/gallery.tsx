import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { Monogram } from '@/components/chapel/monogram';
import { RoyalBackground } from '@/components/chapel/royal-background';
import { CodeGate } from '@/components/gallery/code-gate';
import { GalleryGrid } from '@/components/gallery/gallery-grid';
import { Lightbox } from '@/components/gallery/lightbox';
import { QuizSheet } from '@/components/gallery/quiz-sheet';
import { Slideshow } from '@/components/gallery/slideshow';
import { useGallery } from '@/hooks/use-gallery';
import { useInView } from '@/hooks/use-in-view';
import { useLightboxHistory } from '@/hooks/use-lightbox-history';
import type { CaptureData } from '@/lib/captures';
import { formatWeddingDate } from '@/lib/format';
import { rememberGalleryCode, type GalleryFilter } from '@/lib/gallery-api';
import { myAlbums } from '@/lib/my-albums';
import { fetchChallenges, fetchJson, fetchPartyState, GUEST_GROUPS, type Challenge, type PartyState } from '@/lib/party';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUp, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const FILTERS: { value: GalleryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'collage', label: 'Collages' },
    { value: 'boomerang', label: 'Boomerangs' },
    { value: 'loved', label: 'Most loved' },
    { value: 'challenges', label: 'Challenges' },
    { value: 'mine', label: 'My photos' },
];

const SEARCH_DELAY_MS = 350;

function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);

        return () => window.clearTimeout(timer);
    }, [delay, value]);

    return debounced;
}

/** Every photo and boomerang from the wedding, newest first, updating live. With ?slideshow=1, the projector view. */
export default function Gallery({ slideshow = false }: { slideshow?: boolean }) {
    if (slideshow) {
        return (
            <>
                <Head title="Slideshow" />
                <Slideshow />
            </>
        );
    }

    return <GalleryView />;
}

function GalleryView() {
    const { photobooth } = usePage<SharedData>().props;
    const [filter, setFilter] = useState<GalleryFilter>('all');
    const [search, setSearch] = useState('');
    const query = useDebounced(search, SEARCH_DELAY_MS);
    const [group, setGroup] = useState<string | null>(null);
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const gallery = useGallery(filter, query, { group, challenge: challenge?.id ?? null });
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [quizCount, setQuizCount] = useState(0);
    const [quizOpen, setQuizOpen] = useState(false);
    const [mosaic, setMosaic] = useState<PartyState['mosaic']>(null);
    const modules = photobooth.modules;
    const lightbox = useLightboxHistory();
    const [codeChecking, setCodeChecking] = useState(false);
    const [codeRejected, setCodeRejected] = useState(false);
    const [sentinelRef, sentinelVisible] = useInView<HTMLDivElement>('1200px');
    const [hasAlbums, setHasAlbums] = useState(false);

    const date = formatWeddingDate(photobooth.wedding_date, { weekday: undefined });
    const openIndex = useMemo(() => gallery.items.findIndex((item) => item.uuid === lightbox.openUuid), [gallery.items, lightbox.openUuid]);

    useEffect(() => setHasAlbums(myAlbums().length > 0), []);

    // Party modules: challenges, the quiz and the mosaic, each only when switched on.
    useEffect(() => {
        if (modules.challenges) {
            void fetchChallenges()
                .then(setChallenges)
                .catch(() => undefined);
        }

        if (modules.quiz) {
            void fetchJson<{ data: unknown[] }>('/api/quiz')
                .then(({ data }) => setQuizCount(data.length))
                .catch(() => undefined);
        }

        if (modules.mosaic) {
            void fetchPartyState()
                .then((state) => setMosaic(state.mosaic))
                .catch(() => undefined);
        }
    }, [modules.challenges, modules.mosaic, modules.quiz]);

    useEffect(() => {
        if (sentinelVisible && gallery.hasMore) {
            gallery.loadMore();
        }
    }, [gallery, sentinelVisible]);

    // A wrong wedding code comes back as another "code" error.
    useEffect(() => {
        if (gallery.status !== 'loading') {
            setCodeRejected(codeChecking && gallery.error?.kind === 'code');
            setCodeChecking(false);
        }
    }, [gallery.status]); // eslint-disable-line react-hooks/exhaustive-deps

    const openCapture = useCallback((capture: CaptureData) => lightbox.open(capture.uuid), [lightbox]);

    const submitCode = (code: string) => {
        rememberGalleryCode(code);
        setCodeChecking(true);
        gallery.retry();
    };

    if (gallery.error?.kind === 'code' || (codeChecking && gallery.status === 'loading')) {
        return (
            <RoyalBackground className="px-4 py-8">
                <Head title="Wedding photos" />
                <CodeGate onSubmit={submitCode} rejected={codeRejected} checking={codeChecking} />
            </RoyalBackground>
        );
    }

    const count =
        gallery.total === 0
            ? 'The first photos are on their way'
            : gallery.total === 1
              ? '1 photo and counting'
              : `${gallery.total.toLocaleString()} photos and counting`;

    return (
        <RoyalBackground className="pb-16">
            <Head title="Wedding photos" />

            <header className="flex flex-col items-center gap-3 px-4 pt-10 pb-6 text-center">
                <Link href="/" aria-label="Welcome screen" className="w-16">
                    <Monogram />
                </Link>
                <h1 className="font-display text-mist text-[clamp(2.4rem,8vw,4rem)] leading-tight italic">{photobooth.couple.short}</h1>
                {date && <p className="text-gold-light text-sm font-medium tracking-[0.14em]">{date}</p>}
                <GoldOrnament width="w-12" className="my-1" />
                <p className="text-mist/80" aria-live="polite">
                    {count}
                </p>
                {modules.quiz && quizCount > 0 && (
                    <GhostButton type="button" onClick={() => setQuizOpen(true)} className="mt-2">
                        How well do you know {photobooth.couple.short}? Take the quiz
                    </GhostButton>
                )}
            </header>

            {mosaic && (
                <section className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-4 px-4 text-center sm:flex-row sm:text-left">
                    <a href={mosaic.preview} className="block w-40 shrink-0 shadow-[0_14px_30px_rgb(0_0_0/0.45)]">
                        <img src={mosaic.preview} alt="The grand-finale mosaic" className="w-full" />
                    </a>
                    <div className="flex flex-col gap-2">
                        <p className="font-display text-gold-light text-2xl italic">The grand-finale mosaic</p>
                        <p className="text-mist/75 text-sm">One picture of the couple, made from every photo taken tonight. Zoom in to find yours.</p>
                        <GoldButton asChild className="self-center sm:self-start">
                            <a href={mosaic.download} download={`${photobooth.download_prefix}-Mosaic.jpg`}>
                                Download the mosaic
                            </a>
                        </GoldButton>
                    </div>
                </section>
            )}

            {/* Sticky toolbar: what to show, and search by name. */}
            <div className="frosted sticky top-0 z-30 border-x-0 border-t-0">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div role="tablist" aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
                        {FILTERS.filter((item) => item.value !== 'mine' || hasAlbums)
                            .filter((item) => item.value !== 'loved' || modules.hearts)
                            .filter((item) => item.value !== 'challenges' || (modules.challenges && challenges.length > 0))
                            .filter((item) => (item.value !== 'collage' && item.value !== 'boomerang') || photobooth.modes.includes(item.value))
                            .map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={filter === item.value}
                                    onClick={() => {
                                        setFilter(item.value);
                                        setChallenge(null);
                                    }}
                                    className={cn(
                                        'min-h-11 shrink-0 rounded-full px-4 text-[0.95rem] transition-colors duration-200',
                                        filter === item.value
                                            ? 'bg-gold-light/15 text-gold-light ring-gold/70 ring-1'
                                            : 'text-mist/75 hover:text-mist',
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                    </div>
                    <label className="relative block sm:w-80">
                        <span className="sr-only">Find your photos by name</span>
                        <Search className="text-gold-light/80 pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Find your photos by name"
                            className="border-gold-light/30 bg-navy/70 text-mist placeholder:text-mist/45 focus:border-gold h-11 w-full rounded-full border pr-10 pl-10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                        />
                        {search && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => setSearch('')}
                                className="text-mist/70 absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </label>
                </div>
            </div>

            {modules.who_are_you && filter !== 'mine' && filter !== 'challenges' && (
                <div
                    className="mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-3 pt-4 [scrollbar-width:none] sm:px-6"
                    role="group"
                    aria-label="Show photos from"
                >
                    {[{ value: null, label: 'Everyone' }, ...GUEST_GROUPS].map((option) => (
                        <button
                            key={option.label}
                            type="button"
                            aria-pressed={group === option.value}
                            onClick={() => setGroup(option.value)}
                            className={cn(
                                'min-h-10 shrink-0 rounded-full border px-4 text-sm',
                                group === option.value
                                    ? 'border-gold bg-gold/15 text-gold-light'
                                    : 'border-gold-light/20 text-mist/70 hover:text-mist',
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {gallery.pending.length > 0 && (
                    <motion.button
                        type="button"
                        onClick={() => {
                            gallery.showPending();
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="bg-gold-leaf text-navy fixed top-28 left-1/2 z-30 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full px-5 text-sm font-medium sm:top-20"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                    >
                        <ArrowUp className="size-4" />
                        {gallery.pending.length === 1 ? '1 new photo' : `${gallery.pending.length} new photos`}
                    </motion.button>
                )}
            </AnimatePresence>

            <main className="mx-auto max-w-7xl px-3 pt-5 sm:px-6">
                {filter === 'challenges' && !challenge ? (
                    <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
                        {challenges.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => setChallenge(item)}
                                    className="border-gold-light/25 hover:border-gold-light/60 flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left"
                                >
                                    <span className="font-display text-mist text-xl italic">{item.title}</span>
                                    <span className="text-gold-light shrink-0 text-sm">
                                        {item.photos === 1 ? '1 photo' : `${item.photos} photos`}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    filter === 'challenges' &&
                    challenge &&
                    gallery.status !== 'error' && (
                        <div className="mb-5 flex flex-wrap items-center gap-3">
                            <GhostButton type="button" onClick={() => setChallenge(null)} className="min-h-10 px-4 text-sm">
                                All challenges
                            </GhostButton>
                            <p className="font-display text-gold-light text-2xl italic">{challenge.title}</p>
                        </div>
                    )
                )}
                {filter === 'challenges' && !challenge ? null : gallery.status === 'loading' ? (
                    <LoadingGrid />
                ) : gallery.status === 'error' ? (
                    <Message
                        title={gallery.error?.kind === 'offline' ? 'You seem to be offline' : 'The photos could not be loaded'}
                        body={
                            gallery.error?.kind === 'offline'
                                ? 'The photos will appear as soon as you are back online.'
                                : 'Please try again in a moment.'
                        }
                        action={<GhostButton onClick={gallery.retry}>Try again</GhostButton>}
                    />
                ) : gallery.items.length === 0 ? (
                    <EmptyState filter={filter} query={query} onClear={() => setSearch('')} />
                ) : (
                    <>
                        <GalleryGrid items={gallery.items} onOpen={openCapture} hearts={modules.hearts} />
                        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
                        {gallery.loadingMore && <p className="text-mist/60 py-8 text-center text-sm">Loading more photos…</p>}
                        {!gallery.hasMore && gallery.items.length > 12 && (
                            <div className="flex flex-col items-center gap-3 py-12">
                                <GoldOrnament width="w-12" />
                                <p className="font-display text-mist/75 italic">That is every photo so far</p>
                            </div>
                        )}
                    </>
                )}
            </main>

            <AnimatePresence>
                {openIndex >= 0 && (
                    <Lightbox
                        key="lightbox"
                        items={gallery.items}
                        index={openIndex}
                        onMove={(next) => lightbox.move(gallery.items[next].uuid)}
                        onClose={lightbox.close}
                        onNearEnd={gallery.hasMore ? gallery.loadMore : undefined}
                        hearts={modules.hearts}
                    />
                )}
            </AnimatePresence>
            <QuizSheet open={quizOpen} onClose={() => setQuizOpen(false)} />
        </RoyalBackground>
    );
}

function LoadingGrid() {
    const heights = [260, 180, 320, 220, 280, 200, 240, 300];

    return (
        <div className="flex gap-3 sm:gap-4" aria-label="Loading photos">
            {[0, 1, 2].map((column) => (
                <div key={column} className={cn('flex flex-1 flex-col gap-3 sm:gap-4', column === 2 && 'hidden sm:flex')}>
                    {heights.slice(column, column + 4).map((height, index) => (
                        <div key={index} className="bg-navy-2/70 animate-pulse rounded-[3px]" style={{ height }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

function Message({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
            <p className="font-display text-gold-light text-3xl italic">{title}</p>
            <GoldOrnament width="w-10" />
            <p className="text-mist/75">{body}</p>
            {action}
        </div>
    );
}

function EmptyState({ filter, query, onClear }: { filter: GalleryFilter; query: string; onClear: () => void }) {
    if (query.trim()) {
        return (
            <Message
                title="No photos match that name yet"
                body="Check the spelling, or try the first name only. New photos arrive all evening."
                action={<GhostButton onClick={onClear}>Show all photos</GhostButton>}
            />
        );
    }

    if (filter === 'mine') {
        return (
            <Message
                title="Your photos will be here"
                body="Scan the QR code on the booth screen after your photos, and they appear here on this phone."
            />
        );
    }

    return (
        <Message
            title="The first photos are on their way"
            body="Head to the photo booth and be the first in the gallery."
            action={
                <GoldButton asChild>
                    <Link href="/">Take photos</Link>
                </GoldButton>
            }
        />
    );
}
