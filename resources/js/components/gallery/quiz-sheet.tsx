import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { IconButton } from '@/components/chapel/icon-button';
import { deviceId } from '@/lib/device';
import { fetchJson } from '@/lib/party';
import { cn } from '@/lib/utils';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useState } from 'react';

interface Question {
    id: number;
    question: string;
    choices: string[];
}

interface Result {
    score: number;
    total: number;
    verdict: string;
    results?: { question_id: number; chosen: number | null; correct: number }[];
}

type Leader = { name: string; score: number };

/** "How well do you know the couple?" One try per phone, with an instant score. */
export function QuizSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { photobooth } = usePage<SharedData>().props;
    const [questions, setQuestions] = useState<Question[]>([]);
    const [step, setStep] = useState<'name' | 'questions' | 'result'>('name');
    const [index, setIndex] = useState(0);
    const [name, setName] = useState('');
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [result, setResult] = useState<Result | null>(null);
    const [leaders, setLeaders] = useState<Leader[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const nameId = useId();

    useEffect(() => {
        if (!open) {
            return;
        }

        void fetchJson<{ data: Question[] }>('/api/quiz').then(({ data }) => setQuestions(data));
        void fetchJson<{ data: Leader[] }>('/api/quiz/leaderboard').then(({ data }) => setLeaders(data));

        // Played before on this phone: show that score again.
        fetchJson<{ data: Result & { name: string } }>(`/api/quiz/attempts/${deviceId()}`)
            .then(({ data }) => {
                setResult(data);
                setName(data.name);
                setStep('result');
            })
            .catch(() => undefined);
    }, [open]);

    const choose = (questionId: number, choice: number) => {
        setAnswers((current) => ({ ...current, [questionId]: choice }));

        window.setTimeout(() => {
            if (index < questions.length - 1) {
                setIndex(index + 1);
            }
        }, 250);
    };

    const submit = async () => {
        setSending(true);
        setError(null);

        try {
            const { data } = await fetchJson<{ data: Result }>('/api/quiz/attempts', {
                method: 'POST',
                body: JSON.stringify({ device_id: deviceId(), name: name.trim(), answers }),
            });
            setResult(data);
            setStep('result');
            void fetchJson<{ data: Leader[] }>('/api/quiz/leaderboard').then(({ data: top }) => setLeaders(top));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'That did not work. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const question = questions[index];
    const answeredAll = questions.length > 0 && questions.every((item) => answers[item.id] !== undefined);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="bg-navy/80 fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Couple quiz"
                        className="border-gold-light/25 bg-navy-2 relative flex max-h-[92dvh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-[1.75rem] border px-6 pt-8 pb-8 sm:rounded-[1.75rem]"
                        initial={{ y: 40 }}
                        animate={{ y: 0 }}
                        exit={{ y: 40 }}
                    >
                        <IconButton aria-label="Close the quiz" onClick={onClose} className="absolute top-3 right-3">
                            <X />
                        </IconButton>
                        <div className="flex flex-col items-center gap-2 text-center">
                            <p className="font-display text-gold-light text-lg italic">The couple quiz</p>
                            <h2 className="font-display text-mist text-3xl leading-tight italic">How well do you know {photobooth.couple.short}?</h2>
                            <GoldOrnament width="w-10" />
                        </div>

                        {step === 'name' && (
                            <div className="flex flex-col gap-4">
                                <p className="text-mist/80 text-center">
                                    {questions.length} questions, one try each. Your name goes on the leaderboard on the big screen.
                                </p>
                                <label htmlFor={nameId} className="text-mist/80 text-sm">
                                    Your name
                                </label>
                                <input
                                    id={nameId}
                                    value={name}
                                    maxLength={80}
                                    onChange={(event) => setName(event.target.value)}
                                    className="border-gold-light/30 bg-navy text-mist focus:border-gold h-14 rounded-2xl border px-5 focus:outline-none"
                                />
                                <GoldButton
                                    type="button"
                                    size="lg"
                                    disabled={!name.trim() || questions.length === 0}
                                    onClick={() => setStep('questions')}
                                >
                                    Start the quiz
                                </GoldButton>
                            </div>
                        )}

                        {step === 'questions' && question && (
                            <div className="flex flex-col gap-4">
                                <p className="text-mist/60 text-center text-sm">
                                    Question {index + 1} of {questions.length}
                                </p>
                                <p className="font-display text-mist text-center text-2xl leading-snug">{question.question}</p>
                                <div className="flex flex-col gap-2" role="radiogroup" aria-label={question.question}>
                                    {question.choices.map((choice, choiceIndex) => (
                                        <button
                                            key={choiceIndex}
                                            type="button"
                                            role="radio"
                                            aria-checked={answers[question.id] === choiceIndex}
                                            onClick={() => choose(question.id, choiceIndex)}
                                            className={cn(
                                                'min-h-14 rounded-2xl border px-5 text-left text-base transition-colors',
                                                answers[question.id] === choiceIndex
                                                    ? 'border-gold bg-gold/15 text-gold-light'
                                                    : 'border-gold-light/25 text-mist hover:border-gold-light/50',
                                            )}
                                        >
                                            {choice}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-3">
                                    <GhostButton type="button" className="flex-1" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                                        Back
                                    </GhostButton>
                                    {index < questions.length - 1 ? (
                                        <GhostButton
                                            type="button"
                                            className="flex-1"
                                            disabled={answers[question.id] === undefined}
                                            onClick={() => setIndex(index + 1)}
                                        >
                                            Next
                                        </GhostButton>
                                    ) : (
                                        <GoldButton type="button" className="flex-1" disabled={!answeredAll || sending} onClick={() => void submit()}>
                                            {sending ? 'Checking…' : 'See my score'}
                                        </GoldButton>
                                    )}
                                </div>
                                {error && (
                                    <p role="alert" className="text-center text-sm text-[#f0b3aa]">
                                        {error}
                                    </p>
                                )}
                            </div>
                        )}

                        {step === 'result' && result && (
                            <div className="flex flex-col items-center gap-5 text-center">
                                <p className="font-display text-gold-light text-6xl">
                                    {result.score}
                                    <span className="text-mist/60 text-3xl">/{result.total}</span>
                                </p>
                                <p className="font-display text-mist text-xl italic">{result.verdict}</p>
                                {result.results && (
                                    <ul className="flex w-full flex-col gap-2 text-left text-sm">
                                        {questions.map((item) => {
                                            const answer = result.results?.find((entry) => entry.question_id === item.id);
                                            const right = answer?.chosen === answer?.correct;

                                            return (
                                                <li key={item.id} className="border-gold-light/15 flex items-start gap-3 rounded-xl border p-3">
                                                    {right ? (
                                                        <Check className="text-gold-light mt-0.5 size-4 shrink-0" />
                                                    ) : (
                                                        <X className="mt-0.5 size-4 shrink-0 text-[#f0b3aa]" />
                                                    )}
                                                    <span className="text-mist/85">
                                                        {item.question} <span className="text-gold-light">{item.choices[answer?.correct ?? 0]}</span>
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {leaders.length > 0 && (
                                    <div className="w-full">
                                        <p className="font-display text-gold-light mb-2 text-xl italic">Leaderboard</p>
                                        <ol className="flex flex-col">
                                            {leaders.map((leader, position) => (
                                                <li
                                                    key={`${leader.name}-${position}`}
                                                    className="border-gold-light/10 flex justify-between border-b py-2 text-sm"
                                                >
                                                    <span className="text-mist">
                                                        {position + 1}. {leader.name}
                                                    </span>
                                                    <span className="text-gold-light">{leader.score}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}
                                <GhostButton type="button" onClick={onClose}>
                                    Back to the photos
                                </GhostButton>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
