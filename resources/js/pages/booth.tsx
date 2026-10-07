import { BoomerangFramePicker } from '@/components/booth/boomerang-frame-picker';
import { BoomerangReview } from '@/components/booth/boomerang-review';
import { BoothHeader } from '@/components/booth/booth-header';
import { CameraProvider, useBoothCamera } from '@/components/booth/camera-context';
import { CaptureScreen } from '@/components/booth/capture-screen';
import { DoneScreen } from '@/components/booth/done-screen';
import { FramePicker } from '@/components/booth/frame-picker';
import { LookPicker } from '@/components/booth/look-picker';
import { ModePicker } from '@/components/booth/mode-picker';
import { ReviewScreen, type GuestDetails } from '@/components/booth/review-screen';
import { UploadFallback } from '@/components/booth/upload-fallback';
import { GhostButton } from '@/components/chapel/gold-button';
import { KioskShell } from '@/components/chapel/kiosk-shell';
import { useAlbum } from '@/hooks/use-album';
import { useIdle } from '@/hooks/use-idle';
import { useObjectUrls } from '@/hooks/use-object-urls';
import { closeAlbum, ensureAlbum } from '@/lib/album-session';
import { BOOMERANG_FRAMES, type BoomerangClip, type BoomerangFrame, type BoomerangFrameId } from '@/lib/boomerang';
import { brandFrom } from '@/lib/brand';
import { composeCollage } from '@/lib/compose';
import type { Layout } from '@/lib/layouts';
import { fetchChallenges, type Challenge } from '@/lib/party';
import { clearSession, loadSession, newSessionId, saveSession, type BoothSession, type ShotSource } from '@/lib/session-store';
import { getStation } from '@/lib/station';
import { applyStickers } from '@/lib/stickers';
import { boomerangItem, collageItem } from '@/lib/upload-capture';
import { enqueue } from '@/lib/upload-queue';
import type { CaptureMode, LookSlug, SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PickerStep = 'mode' | 'frame' | 'look';
type Step = PickerStep | 'camera' | 'review' | 'done';

const NO_DETAILS: GuestDetails = { guestName: '', wish: '', signature: null, groupTag: null, tableNo: '', stickers: [] };

const IDLE_RETURN_MS = 90_000;

const TITLES: Record<PickerStep | 'review' | 'boomerang' | 'upload', string> = {
    mode: 'What would you like to make?',
    frame: 'Choose your frame',
    look: 'Choose a look',
    review: 'Your photos',
    boomerang: 'Your boomerang',
    upload: 'Take your photos',
};

interface BoothProps {
    layouts: Layout[];
}

export default function Booth({ layouts }: BoothProps) {
    return (
        <CameraProvider>
            <Head title="Take photos" />
            <BoothFlow layouts={layouts} />
        </CameraProvider>
    );
}

function BoothFlow({ layouts }: BoothProps) {
    const { photobooth } = usePage<SharedData>().props;
    const camera = useBoothCamera();
    const reduceMotion = useReducedMotion();
    const { isIdle } = useIdle(IDLE_RETURN_MS);

    const modes = useMemo<CaptureMode[]>(() => (photobooth.modes.length > 0 ? photobooth.modes : ['collage']), [photobooth.modes]);
    const looks = useMemo<LookSlug[]>(
        () => (photobooth.looks.length > 0 ? photobooth.looks : [photobooth.default_look]),
        [photobooth.looks, photobooth.default_look],
    );
    const defaultLook = looks.includes(photobooth.default_look) ? photobooth.default_look : looks[0];
    const askForLook = photobooth.look_picker_enabled && looks.length > 1;

    // The mode screen also holds the challenge deck, so it shows when challenges are on.
    const showModeStep = modes.length > 1 || photobooth.modules.challenges;

    const steps = useMemo<Step[]>(
        () => [...(showModeStep ? (['mode'] as const) : []), 'frame', ...(askForLook ? (['look'] as const) : []), 'camera'],
        [askForLook, showModeStep],
    );

    const [mode, setMode] = useState<CaptureMode>(modes[0]);
    const [layout, setLayout] = useState<Layout | null>(null);
    const [look, setLook] = useState<LookSlug>(defaultLook);
    const [step, setStep] = useState<Step>(() => steps[0]);
    const [shots, setShots] = useState<(Blob | null)[]>([]);
    const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
    const [preferUpload, setPreferUpload] = useState(false);
    const [details, setDetails] = useState<GuestDetails>(NO_DETAILS);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [done, setDone] = useState<{ preview: Blob; captureId: string } | null>(null);
    const [burst, setBurst] = useState<ImageBitmap[] | null>(null);
    const [clip, setClip] = useState<BoomerangClip | null>(null);
    const [boomerangFrame, setBoomerangFrame] = useState<BoomerangFrame>(BOOMERANG_FRAMES.classic);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const session = useRef<BoothSession | null>(null);
    const album = useAlbum();

    const shotUrls = useObjectUrls(shots);

    const goNext = (from: Step) => {
        setStep(steps[steps.indexOf(from) + 1] ?? 'camera');
    };

    const goBack = () => {
        if (step === 'camera' && retakeIndex !== null) {
            setRetakeIndex(null);
            setStep('review');

            return;
        }

        const index = steps.indexOf(step);

        if (index <= 0) {
            void finish();

            return;
        }

        setStep(steps[index - 1]);
    };

    const startOver = useCallback(() => {
        void clearSession();
        session.current = null;
        setShots([]);
        setLayout(null);
        setRetakeIndex(null);
        setDetails(NO_DETAILS);
        setSaveError(null);
        setDone(null);
        setBurst((frames) => {
            frames?.forEach((frame) => frame.close());

            return null;
        });
        setClip(null);
        setChallenge(null);
        setBoomerangFrame(BOOMERANG_FRAMES.classic);
        setStep(steps[0]);
    }, [steps]);

    /** The group is finished (or walked away): close their album and reset for the next group. */
    const finish = useCallback(async () => {
        await clearSession();
        await closeAlbum();
        router.visit('/');
    }, []);

    /** Name, wish and signature are kept with the shots, so a reload keeps them too. */
    const changeDetails = useCallback((next: GuestDetails) => {
        setDetails(next);

        if (session.current) {
            session.current = {
                ...session.current,
                guestName: next.guestName,
                wish: next.wish,
                signature: next.signature,
                groupTag: next.groupTag,
                tableNo: next.tableNo,
                stickers: next.stickers,
            };
            void saveSession(session.current);
        }
    }, []);

    /** Saves to this device's upload queue first; the queue sends it when it can. */
    const queueCollage = useCallback(
        async (collage: Blob, guest: GuestDetails) => {
            const current = session.current;

            if (!layout || !current) {
                return null;
            }

            await enqueue(
                collageItem({
                    clientUuid: current.id,
                    albumClientUuid: album?.clientUuid ?? null,
                    layoutSlug: layout.slug,
                    look,
                    collage,
                    shots: shots.filter((shot): shot is Blob => shot !== null),
                    signature: guest.signature,
                    guestName: guest.guestName,
                    wish: guest.wish,
                    camera: current.camera,
                    station: getStation(),
                    groupTag: guest.groupTag,
                    tableNo: guest.tableNo,
                    challengeId: current.challenge?.id ?? null,
                }),
            );
            await clearSession();
            session.current = null;

            return current.id;
        },
        [album, layout, look, shots],
    );

    const saveCollage = async (collage: Blob) => {
        setSaving(true);
        setSaveError(null);

        try {
            const captureId = await queueCollage(collage, details);

            if (captureId) {
                setDone({ preview: collage, captureId });
                setStep('done');
            }
        } catch {
            setSaveError('This collage could not be saved on the booth. Please tell the staff.');
        } finally {
            setSaving(false);
        }
    };

    /** A boomerang burst was recorded: start a session and make the clip on the review screen. */
    const handleBurst = useCallback(
        (frames: ImageBitmap[], source: ShotSource) => {
            session.current = {
                id: session.current?.id ?? newSessionId(),
                mode: 'boomerang',
                layoutSlug: null,
                look,
                shots: [],
                camera: source,
                challenge: challenge ? { id: challenge.id, title: challenge.title } : null,
                boomerangFrame: boomerangFrame.id,
                updatedAt: Date.now(),
            };
            setBurst((previous) => {
                previous?.forEach((frame) => frame.close());

                return frames;
            });
            setClip(null);
            setStep('review');
        },
        [boomerangFrame, challenge, look],
    );

    /** The clip is ready: keep it in the session store so a reload does not lose it. */
    const handleBuilt = useCallback((built: BoomerangClip) => {
        setClip(built);
        setBurst((frames) => {
            frames?.forEach((frame) => frame.close());

            return null;
        });

        if (session.current) {
            session.current = { ...session.current, boomerang: built };
            void saveSession(session.current);
        }
    }, []);

    const queueBoomerang = useCallback(
        async (finished: BoomerangClip, guest: GuestDetails) => {
            const current = session.current;

            if (!current) {
                return null;
            }

            await enqueue(
                boomerangItem({
                    clientUuid: current.id,
                    albumClientUuid: album?.clientUuid ?? null,
                    look,
                    clip: finished,
                    signature: guest.signature,
                    guestName: guest.guestName,
                    wish: guest.wish,
                    camera: current.camera,
                    station: getStation(),
                    groupTag: guest.groupTag,
                    tableNo: guest.tableNo,
                    challengeId: current.challenge?.id ?? null,
                }),
            );
            await clearSession();
            session.current = null;

            return current.id;
        },
        [album, look],
    );

    const saveBoomerang = async (finished: BoomerangClip) => {
        setSaving(true);
        setSaveError(null);

        try {
            const captureId = await queueBoomerang(finished, details);

            if (captureId) {
                setDone({ preview: finished.clip, captureId });
                setStep('done');
            }
        } catch {
            setSaveError('This boomerang could not be saved on the booth. Please tell the staff.');
        } finally {
            setSaving(false);
        }
    };

    const tryBoomerangAgain = () => {
        setClip(null);
        setBurst((frames) => {
            frames?.forEach((frame) => frame.close());

            return null;
        });

        if (session.current) {
            session.current = { ...session.current, boomerang: null };
            void saveSession(session.current);
        }

        setStep('camera');
    };

    const pickFrame = (picked: Layout) => {
        if (layout?.slug !== picked.slug || shots.length !== picked.shots) {
            session.current = null;
            setShots(Array.from({ length: picked.shots }, () => null));
        }

        setLayout(picked);
        goNext('frame');
    };

    /** Every shot goes to IndexedDB the moment it is taken. */
    const storeShot = useCallback(
        async (index: number, blob: Blob, source: ShotSource) => {
            const base: BoothSession = session.current ?? {
                id: newSessionId(),
                mode,
                layoutSlug: layout?.slug ?? null,
                look,
                shots: Array.from({ length: layout?.shots ?? 1 }, () => null),
                camera: source,
                challenge: challenge ? { id: challenge.id, title: challenge.title } : null,
                updatedAt: Date.now(),
            };
            const nextShots = [...base.shots];
            nextShots[index] = blob;

            session.current = { ...base, look, camera: source, shots: nextShots };
            setShots(nextShots);
            await saveSession(session.current);
        },
        [challenge, layout, look, mode],
    );

    // A reload in the middle of a session picks up exactly where the group was.
    useEffect(() => {
        let alive = true;

        void loadSession().then((saved) => {
            if (alive && saved?.mode === 'boomerang' && saved.boomerang) {
                session.current = saved;
                setMode('boomerang');
                setLook(saved.look);
                setClip(saved.boomerang);
                setBoomerangFrame(BOOMERANG_FRAMES[(saved.boomerangFrame as BoomerangFrameId) ?? 'classic'] ?? BOOMERANG_FRAMES.classic);
                setChallenge(saved.challenge ? { ...saved.challenge, photos: 0 } : null);
                setDetails(detailsFrom(saved));
                setStep('review');

                return;
            }

            const savedLayout = layouts.find((candidate) => candidate.slug === saved?.layoutSlug);

            if (!alive || !saved || saved.mode !== 'collage' || !savedLayout || !saved.shots.some(Boolean)) {
                return;
            }

            const restored = Array.from({ length: savedLayout.shots }, (_, index) => saved.shots[index] ?? null);
            session.current = { ...saved, shots: restored };
            setMode('collage');
            setLayout(savedLayout);
            setLook(saved.look);
            setShots(restored);
            setChallenge(saved.challenge ? { ...saved.challenge, photos: 0 } : null);
            setDetails(detailsFrom(saved));
            setStep(restored.every(Boolean) ? 'review' : 'camera');
        });

        return () => {
            alive = false;
        };
    }, [layouts]);

    // Warm the camera up as soon as it will be needed, so the countdown starts fast.
    useEffect(() => {
        if ((step === 'look' || step === 'camera') && camera.status === 'idle') {
            void camera.start();
        }
    }, [camera, step]);

    // Photo challenges for the deck on the mode screen.
    useEffect(() => {
        if (photobooth.modules.challenges) {
            void fetchChallenges()
                .then(setChallenges)
                .catch(() => undefined);
        }
    }, [photobooth.modules.challenges]);

    // Each group at the booth gets an album; it stays open until they tap "I'm done".
    useEffect(() => {
        void ensureAlbum(getStation());
    }, []);

    // A walked-away group leaves the booth clean for the next one. A finished
    // collage they never saved is saved for them, so no photo is ever lost.
    // (The Done screen runs its own visible 90-second countdown.)
    useEffect(() => {
        if (!isIdle || step === 'done') {
            return;
        }

        void (async () => {
            if (step === 'review' && mode === 'boomerang' && clip) {
                await queueBoomerang(clip, details).catch(() => null);
            }

            if (step === 'review' && mode === 'collage' && layout && shots.length > 0 && shots.every(Boolean)) {
                try {
                    const collage = await composeCollage({
                        layout,
                        shots,
                        look,
                        brand: brandFrom(photobooth),
                        guestName: details.guestName,
                        wish: details.wish,
                    });
                    await queueCollage(details.stickers?.length ? await applyStickers(collage, details.stickers) : collage, details);
                } catch {
                    // The shots stay in the session store and resume on the next visit.
                    router.visit('/');

                    return;
                }
            }

            await finish();
        })();
    }, [isIdle]); // eslint-disable-line react-hooks/exhaustive-deps

    const useUpload = preferUpload || camera.status === 'unsupported' || (camera.status === 'error' && camera.error?.kind === 'not-found');
    const transition = reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };
    const fullScreenCamera = step === 'camera' && !useUpload;

    const header = (title: string) => (
        <BoothHeader title={title} onBack={goBack} backLabel={steps.indexOf(step) === 0 ? 'Back to the welcome screen' : 'Back'} />
    );

    return (
        <KioskShell>
            <LayoutGroup>
                <AnimatePresence mode="wait" initial={false}>
                    {fullScreenCamera ? (
                        <motion.div
                            key="camera"
                            className="absolute inset-0"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={transition}
                        >
                            {mode === 'collage' && layout ? (
                                <CaptureScreen
                                    layout={layout}
                                    look={look}
                                    shotUrls={shotUrls}
                                    retakeIndex={retakeIndex}
                                    onShot={storeShot}
                                    onComplete={() => {
                                        setRetakeIndex(null);
                                        setStep('review');
                                    }}
                                    onBack={goBack}
                                    onUseUpload={() => setPreferUpload(true)}
                                    promptOverride={challenge?.title ?? null}
                                />
                            ) : (
                                <CaptureScreen
                                    layout={null}
                                    look={look}
                                    shotUrls={[]}
                                    retakeIndex={null}
                                    onShot={async () => undefined}
                                    onComplete={() => undefined}
                                    onBack={goBack}
                                    onUseUpload={() => setPreferUpload(true)}
                                    onBurst={handleBurst}
                                    boomerangFrame={boomerangFrame}
                                    promptOverride={challenge?.title ?? null}
                                />
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key={step}
                            className="flex min-h-0 flex-1 flex-col"
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -24 }}
                            transition={transition}
                        >
                            {step === 'mode' && (
                                <>
                                    {header(TITLES.mode)}
                                    <ModePicker
                                        modes={modes}
                                        onPick={(picked) => {
                                            setChallenge(null);
                                            setMode(picked);
                                            goNext('mode');
                                        }}
                                        challenges={photobooth.modules.challenges ? challenges : []}
                                        onPickChallenge={(picked) => {
                                            const challengeMode: CaptureMode = modes.includes('collage') ? 'collage' : modes[0];
                                            setChallenge(picked);
                                            setMode(challengeMode);
                                            goNext('mode');
                                        }}
                                    />
                                </>
                            )}

                            {step === 'frame' && (
                                <>
                                    {header(TITLES.frame)}
                                    {challenge && <p className="text-gold-light -mt-1 text-center">Challenge: {challenge.title}</p>}
                                    {mode === 'boomerang' ? (
                                        <BoomerangFramePicker
                                            onPick={(picked) => {
                                                setBoomerangFrame(picked);
                                                goNext('frame');
                                            }}
                                        />
                                    ) : (
                                        <FramePicker layouts={layouts} onPick={pickFrame} />
                                    )}
                                </>
                            )}

                            {step === 'look' && (
                                <>
                                    {header(TITLES.look)}
                                    <LookPicker looks={looks} selected={look} onSelect={setLook} onContinue={() => goNext('look')} />
                                </>
                            )}

                            {step === 'camera' && layout && (
                                <>
                                    {header(TITLES.upload)}
                                    <UploadFallback
                                        layout={layout}
                                        shotUrls={shotUrls}
                                        reason={camera.error?.message ?? null}
                                        retakeIndex={retakeIndex}
                                        onShot={storeShot}
                                        onComplete={() => {
                                            setRetakeIndex(null);
                                            setStep('review');
                                        }}
                                    />
                                </>
                            )}

                            {step === 'camera' && mode === 'boomerang' && (
                                <>
                                    {header(TITLES.boomerang)}
                                    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                                        <p className="text-mist max-w-sm">
                                            {camera.error?.message ?? 'The live camera is not available on this device.'} Boomerangs need the live
                                            camera.
                                        </p>
                                        {modes.includes('collage') && (
                                            <GhostButton
                                                type="button"
                                                onClick={() => {
                                                    setMode('collage');
                                                    setStep('frame');
                                                }}
                                            >
                                                Make a photo collage instead
                                            </GhostButton>
                                        )}
                                    </div>
                                </>
                            )}

                            {step === 'review' && mode === 'boomerang' && (
                                <>
                                    <h1 className="font-display text-gold-light text-center text-[clamp(1.6rem,4.2vw,2.6rem)] leading-tight italic">
                                        {TITLES.boomerang}
                                    </h1>
                                    <BoomerangReview
                                        frame={boomerangFrame}
                                        frames={burst}
                                        clip={clip}
                                        look={look}
                                        details={details}
                                        onDetailsChange={changeDetails}
                                        onBuilt={handleBuilt}
                                        onTryAgain={tryBoomerangAgain}
                                        onSave={saveBoomerang}
                                        saving={saving}
                                        saveError={saveError}
                                    />
                                </>
                            )}

                            {step === 'review' && mode === 'collage' && layout && (
                                <>
                                    <h1 className="font-display text-gold-light text-center text-[clamp(1.6rem,4.2vw,2.6rem)] leading-tight italic">
                                        {TITLES.review}
                                    </h1>
                                    <ReviewScreen
                                        layout={layout}
                                        look={look}
                                        shots={shots}
                                        details={details}
                                        onDetailsChange={changeDetails}
                                        onRetake={(index) => {
                                            setRetakeIndex(index);
                                            setStep('camera');
                                        }}
                                        onStartOver={startOver}
                                        onSave={saveCollage}
                                        saving={saving}
                                        saveError={saveError}
                                    />
                                </>
                            )}

                            {step === 'done' && done && (
                                <DoneScreen
                                    preview={done.preview}
                                    captureId={done.captureId}
                                    guestName={details.guestName}
                                    album={album}
                                    onMore={startOver}
                                    onDone={() => void finish()}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </LayoutGroup>
        </KioskShell>
    );
}

function detailsFrom(saved: BoothSession): GuestDetails {
    return {
        guestName: saved.guestName ?? '',
        wish: saved.wish ?? '',
        signature: saved.signature ?? null,
        groupTag: saved.groupTag ?? null,
        tableNo: saved.tableNo ?? '',
        stickers: saved.stickers ?? [],
    };
}
