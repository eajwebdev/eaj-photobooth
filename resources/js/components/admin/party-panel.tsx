import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { Toggle } from '@/components/chapel/toggle';
import { ApiError } from '@/lib/api';
import { pinFetch, storedPin } from '@/lib/pin-api';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

interface AdminChallenge {
    id: number;
    title: string;
    is_active: boolean;
    captures_count: number;
}

interface QuizQuestion {
    id?: number;
    question: string;
    choices: string[];
    answer_index: number;
}

interface MosaicStatus {
    status: 'pending' | 'building' | 'ready' | 'failed';
    error: string | null;
    tiles: number;
    built_at: string | null;
    preview: string | null;
    download: string | null;
    revealed_at: string | null;
}

const inputClass = 'border-gold-light/30 bg-navy text-mist focus:border-gold h-11 rounded-xl border px-3 text-sm focus:outline-none';

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
    return (
        <section className="border-gold-light/20 flex flex-col gap-4 border-t pt-6">
            <div>
                <h2 className="font-display text-gold-light text-2xl italic">{title}</h2>
                {note && <p className="text-mist/60 mt-1 text-sm">{note}</p>}
            </div>
            {children}
        </section>
    );
}

/** Staff tools for the party modules: challenges, the couple quiz and the grand-finale mosaic. */
export function PartyPanel({ onLocked }: { onLocked: () => void }) {
    const { photobooth } = usePage<SharedData>().props;
    const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

    const report = useCallback(
        (caught: unknown) => {
            if (caught instanceof ApiError && caught.status === 401) {
                onLocked();

                return;
            }

            setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'That did not work. Please try again.' });
        },
        [onLocked],
    );

    const off = (module: keyof typeof photobooth.modules) =>
        photobooth.modules[module] ? undefined : 'Switched off in Settings, so guests do not see this yet.';

    return (
        <div className="flex max-w-4xl flex-col gap-10">
            {message && (
                <p
                    role={message.tone === 'error' ? 'alert' : 'status'}
                    className={cn('text-sm', message.tone === 'error' ? 'text-[#f0b3aa]' : 'text-gold-light')}
                >
                    {message.text}
                </p>
            )}
            <Panel title="Photo challenges" note={off('challenges')}>
                <ChallengesEditor onError={report} />
            </Panel>
            <Panel title="Couple quiz" note={off('quiz')}>
                <QuizEditor onError={report} onDone={(text) => setMessage({ tone: 'ok', text })} />
            </Panel>
            <Panel title="Grand-finale mosaic" note={off('mosaic')}>
                <MosaicTools onError={report} onDone={(text) => setMessage({ tone: 'ok', text })} />
            </Panel>
        </div>
    );
}

function ChallengesEditor({ onError }: { onError: (caught: unknown) => void }) {
    const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
    const [title, setTitle] = useState('');

    const load = useCallback(() => {
        pinFetch<{ data: AdminChallenge[] }>('admin', '/challenges')
            .then(({ data }) => setChallenges(data))
            .catch(onError);
    }, [onError]);

    useEffect(load, [load]);

    const save = (challenge: AdminChallenge, patch: Partial<AdminChallenge>) =>
        pinFetch('admin', `/challenges/${challenge.id}`, { method: 'PATCH', body: JSON.stringify(patch) })
            .then(load)
            .catch(onError);

    return (
        <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
                {challenges.map((challenge) => (
                    <li key={challenge.id} className="flex flex-wrap items-center gap-3">
                        <input
                            aria-label="Challenge"
                            defaultValue={challenge.title}
                            maxLength={120}
                            onBlur={(event) =>
                                event.target.value.trim() !== challenge.title && void save(challenge, { title: event.target.value.trim() })
                            }
                            className={cn(inputClass, 'min-w-0 flex-1')}
                        />
                        <span className="text-mist/60 w-20 text-sm">{challenge.captures_count} photos</span>
                        <div className="w-36">
                            <Toggle
                                label={challenge.is_active ? 'Shown' : 'Hidden'}
                                checked={challenge.is_active}
                                onChange={(on) => void save(challenge, { is_active: on })}
                            />
                        </div>
                        <button
                            type="button"
                            aria-label={`Delete “${challenge.title}”`}
                            onClick={() => void pinFetch('admin', `/challenges/${challenge.id}`, { method: 'DELETE' }).then(load).catch(onError)}
                            className="text-mist/60 flex size-11 items-center justify-center rounded-full hover:text-[#f0b3aa]"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </li>
                ))}
            </ul>
            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();

                    if (title.trim()) {
                        void pinFetch('admin', '/challenges', { method: 'POST', body: JSON.stringify({ title: title.trim() }) })
                            .then(() => {
                                setTitle('');
                                load();
                            })
                            .catch(onError);
                    }
                }}
            >
                <input
                    aria-label="New challenge"
                    placeholder="A new challenge"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={cn(inputClass, 'flex-1')}
                />
                <GhostButton type="submit" className="min-h-11">
                    Add
                </GhostButton>
            </form>
        </div>
    );
}

const EMPTY_QUESTION: QuizQuestion = { question: '', choices: ['', '', ''], answer_index: 0 };

function QuizEditor({ onError, onDone }: { onError: (caught: unknown) => void; onDone: (text: string) => void }) {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [draft, setDraft] = useState<QuizQuestion>(EMPTY_QUESTION);
    const [leaders, setLeaders] = useState<{ name: string; score: number }[]>([]);
    const [confirmReset, setConfirmReset] = useState(false);

    const load = useCallback(() => {
        pinFetch<{ data: QuizQuestion[] }>('admin', '/quiz/questions')
            .then(({ data }) => setQuestions(data))
            .catch(onError);
        pinFetch<{ data: { name: string; score: number }[] }>('admin', '/quiz/attempts')
            .then(({ data }) => setLeaders(data))
            .catch(onError);
    }, [onError]);

    useEffect(load, [load]);

    const add = async () => {
        try {
            await pinFetch('admin', '/quiz/questions', {
                method: 'POST',
                body: JSON.stringify({ ...draft, choices: draft.choices.map((choice) => choice.trim()).filter(Boolean) }),
            });
            setDraft(EMPTY_QUESTION);
            load();
        } catch (caught) {
            onError(caught);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <ol className="flex flex-col gap-3">
                {questions.map((question, index) => (
                    <li key={question.id} className="border-gold-light/15 flex items-start justify-between gap-3 rounded-xl border p-3">
                        <div>
                            <p className="text-mist">
                                {index + 1}. {question.question}
                            </p>
                            <p className="text-mist/60 text-sm">
                                {question.choices.map((choice, choiceIndex) => (
                                    <span key={choiceIndex} className={choiceIndex === question.answer_index ? 'text-gold-light' : undefined}>
                                        {choiceIndex > 0 ? ', ' : ''}
                                        {choice}
                                    </span>
                                ))}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label="Delete question"
                            onClick={() => void pinFetch('admin', `/quiz/questions/${question.id}`, { method: 'DELETE' }).then(load).catch(onError)}
                            className="text-mist/60 flex size-11 shrink-0 items-center justify-center rounded-full hover:text-[#f0b3aa]"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    </li>
                ))}
            </ol>

            <div className="border-gold-light/20 flex flex-col gap-3 rounded-2xl border p-4">
                <p className="text-mist/80 text-sm">Add a question, and tap the circle next to the right answer.</p>
                <input
                    aria-label="Question"
                    placeholder="Where did they first meet?"
                    value={draft.question}
                    onChange={(event) => setDraft({ ...draft, question: event.target.value })}
                    className={inputClass}
                />
                {draft.choices.map((choice, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <input
                            type="radio"
                            name="correct-answer"
                            aria-label={`Answer ${index + 1} is right`}
                            checked={draft.answer_index === index}
                            onChange={() => setDraft({ ...draft, answer_index: index })}
                            className="accent-gold size-5"
                        />
                        <input
                            aria-label={`Answer ${index + 1}`}
                            placeholder={`Answer ${index + 1}`}
                            value={choice}
                            onChange={(event) =>
                                setDraft({ ...draft, choices: draft.choices.map((item, at) => (at === index ? event.target.value : item)) })
                            }
                            className={cn(inputClass, 'flex-1')}
                        />
                    </div>
                ))}
                <div className="flex gap-2">
                    {draft.choices.length < 4 && (
                        <GhostButton type="button" className="min-h-11" onClick={() => setDraft({ ...draft, choices: [...draft.choices, ''] })}>
                            Another answer
                        </GhostButton>
                    )}
                    <GoldButton
                        type="button"
                        disabled={!draft.question.trim() || draft.choices.filter((choice) => choice.trim()).length < 2}
                        onClick={() => void add()}
                    >
                        Add question
                    </GoldButton>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <p className="font-display text-gold-light text-xl italic">Leaderboard</p>
                {leaders.length === 0 ? (
                    <p className="text-mist/60 text-sm">Nobody has played yet.</p>
                ) : (
                    <ol className="flex flex-col">
                        {leaders.slice(0, 10).map((leader, index) => (
                            <li key={`${leader.name}-${index}`} className="border-gold-light/10 flex justify-between border-b py-2 text-sm">
                                <span className="text-mist">
                                    {index + 1}. {leader.name}
                                </span>
                                <span className="text-gold-light">{leader.score}</span>
                            </li>
                        ))}
                    </ol>
                )}
                <div className="flex flex-wrap gap-2">
                    <GoldButton
                        type="button"
                        disabled={leaders.length === 0}
                        onClick={() =>
                            void pinFetch('admin', '/quiz/reveal', { method: 'POST' })
                                .then(() => onDone('The winner is on the slideshow now.'))
                                .catch(onError)
                        }
                    >
                        Reveal the winner on the slideshow
                    </GoldButton>
                    {confirmReset ? (
                        <GhostButton
                            type="button"
                            onClick={() =>
                                void pinFetch('admin', '/quiz/reset', { method: 'POST' })
                                    .then(() => {
                                        setConfirmReset(false);
                                        load();
                                        onDone('Every quiz answer has been cleared.');
                                    })
                                    .catch(onError)
                            }
                        >
                            Yes, clear every answer
                        </GhostButton>
                    ) : (
                        <GhostButton type="button" onClick={() => setConfirmReset(true)}>
                            Clear all answers (after a rehearsal)
                        </GhostButton>
                    )}
                </div>
            </div>
        </div>
    );
}

function MosaicTools({ onError, onDone }: { onError: (caught: unknown) => void; onDone: (text: string) => void }) {
    const [mosaic, setMosaic] = useState<MosaicStatus | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const load = useCallback(() => {
        pinFetch<{ data: MosaicStatus | null }>('admin', '/mosaic')
            .then(({ data }) => setMosaic(data))
            .catch(onError);
    }, [onError]);

    useEffect(load, [load]);

    // While it builds, check every few seconds.
    useEffect(() => {
        if (mosaic?.status !== 'pending' && mosaic?.status !== 'building') {
            return;
        }

        const timer = window.setInterval(load, 4000);

        return () => window.clearInterval(timer);
    }, [load, mosaic?.status]);

    const upload = async () => {
        if (!file) {
            return;
        }

        setUploading(true);
        const form = new FormData();
        form.append('photo', file);

        try {
            const response = await fetch('/api/admin/mosaic', {
                method: 'POST',
                body: form,
                headers: { Accept: 'application/json', 'X-Admin-Pin': storedPin('admin') ?? '' },
            });

            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { message?: string } | null;
                throw new ApiError(body?.message ?? 'The photo could not be uploaded.', response.status);
            }

            setFile(null);
            load();
        } catch (caught) {
            onError(caught);
        } finally {
            setUploading(false);
        }
    };

    const action = (path: string, text: string) =>
        void pinFetch<{ data: MosaicStatus }>('admin', path, { method: 'POST' })
            .then(({ data }) => {
                setMosaic(data);
                onDone(text);
            })
            .catch(onError);

    const busy = mosaic?.status === 'pending' || mosaic?.status === 'building';

    return (
        <div className="flex flex-col gap-4">
            <p className="text-mist/75 text-sm">
                Upload a portrait photo of the couple. It is rebuilt from every guest collage (60 × 90 tiles, a 6000 × 9000 picture), which takes a
                minute or two.
            </p>
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="file"
                    accept="image/jpeg,image/png"
                    aria-label="Photo of the couple"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="text-mist text-sm"
                />
                <GoldButton type="button" disabled={!file || uploading || busy} onClick={() => void upload()}>
                    {uploading ? 'Uploading…' : 'Build the mosaic'}
                </GoldButton>
            </div>

            {mosaic && (
                <div className="border-gold-light/20 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row">
                    {mosaic.preview && <img src={mosaic.preview} alt="The mosaic" className="w-40 shrink-0 self-start" />}
                    <div className="flex flex-col gap-3">
                        <p className="text-mist">
                            {busy && 'Building the mosaic…'}
                            {mosaic.status === 'failed' && <span className="text-[#f0b3aa]">It could not be built: {mosaic.error}</span>}
                            {mosaic.status === 'ready' && `Ready, made from ${mosaic.tiles} photos.`}
                            {mosaic.revealed_at && ' It is revealed to guests.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <GhostButton
                                type="button"
                                disabled={busy}
                                onClick={() => action('/mosaic/rebuild', 'Rebuilding with the newest photos.')}
                            >
                                Rebuild with the newest photos
                            </GhostButton>
                            {mosaic.status === 'ready' &&
                                (mosaic.revealed_at ? (
                                    <GhostButton type="button" onClick={() => action('/mosaic/hide', 'The mosaic is hidden from guests again.')}>
                                        Hide from guests
                                    </GhostButton>
                                ) : (
                                    <GoldButton type="button" onClick={() => action('/mosaic/reveal', 'The reveal is playing on the slideshow.')}>
                                        Reveal on the slideshow
                                    </GoldButton>
                                ))}
                            {mosaic.download && (
                                <GhostButton asChild>
                                    <a href={mosaic.download} download>
                                        Download (full size)
                                    </a>
                                </GhostButton>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
