import { captureShot } from '@/lib/capture';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraFacing = 'user' | 'environment';

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'error' | 'unsupported';

export type CameraErrorKind = 'permission' | 'in-use' | 'not-found' | 'insecure' | 'unknown';

export interface CameraError {
    kind: CameraErrorKind;
    message: string;
}

export interface CameraState {
    status: CameraStatus;
    error: CameraError | null;
    stream: MediaStream | null;
    /** The side actually in use, as reported by the device (may differ from the request). */
    facing: CameraFacing;
    /** False when the device only has one camera: hide the switch button. */
    canSwitch: boolean;
    start: (facing?: CameraFacing) => Promise<void>;
    switchCamera: () => Promise<void>;
    /** One raw shot of exactly the guide's crop (`aspect` = slot width / height). */
    capture: (video: HTMLVideoElement, aspect: number) => Promise<Blob>;
    stop: () => void;
}

const FRONT_LABEL = /front|user|selfie|facetime/i;
const BACK_LABEL = /back|rear|environment|world/i;

const ERROR_COPY: Record<CameraErrorKind, string> = {
    permission: 'Camera access is blocked. Allow the camera for this site in your browser settings, then tap Try again.',
    'in-use': 'The camera is being used by another app. Close that app, then tap Try again.',
    'not-found': 'No camera was found on this device.',
    insecure: 'The camera only works over a secure https link. Ask staff to open the booth from its https address.',
    unknown: 'The camera could not start. Tap Try again.',
};

function toCameraError(error: unknown): CameraError {
    const name = error instanceof DOMException || error instanceof Error ? error.name : '';
    const kind: CameraErrorKind =
        name === 'NotAllowedError' || name === 'SecurityError'
            ? 'permission'
            : name === 'NotReadableError' || name === 'AbortError'
              ? 'in-use'
              : name === 'NotFoundError' || name === 'OverconstrainedError'
                ? 'not-found'
                : 'unknown';

    return { kind, message: ERROR_COPY[kind] };
}

function stopStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => track.stop());
}

function detectFacing(stream: MediaStream, requested: CameraFacing): CameraFacing | null {
    const track = stream.getVideoTracks()[0];

    if (!track) {
        return null;
    }

    const reported = track.getSettings().facingMode;

    if (reported === 'user' || reported === 'environment') {
        return reported;
    }

    if (FRONT_LABEL.test(track.label)) {
        return 'user';
    }

    if (BACK_LABEL.test(track.label)) {
        return 'environment';
    }

    // Laptops and webcams report nothing: treat the only camera as the one asked for.
    return requested === 'user' ? 'user' : null;
}

type ExposureCapabilities = MediaTrackCapabilities & {
    exposureCompensation?: { min: number; max: number; step: number };
    exposureMode?: string[];
};

/**
 * Reception lighting is low: where the camera allows it, keep exposure
 * automatic and lift it a little (about a third of the available range).
 */
async function boostLowLight(track: MediaStreamTrack | undefined): Promise<void> {
    if (!track || typeof track.getCapabilities !== 'function') {
        return;
    }

    const capabilities = track.getCapabilities() as ExposureCapabilities;
    const advanced: Record<string, unknown> = {};

    if (capabilities.exposureMode?.includes('continuous')) {
        advanced.exposureMode = 'continuous';
    }

    if (capabilities.exposureCompensation && capabilities.exposureCompensation.max > 0) {
        const { max, step } = capabilities.exposureCompensation;
        advanced.exposureCompensation = Math.round(max / 3 / (step || 1)) * (step || 1);
    }

    if (Object.keys(advanced).length === 0) {
        return;
    }

    try {
        await track.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] });
    } catch {
        // Not supported on this device: the preview simply stays as it is.
    }
}

async function videoInputs(): Promise<MediaDeviceInfo[]> {
    try {
        return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    } catch {
        return [];
    }
}

/** Tries the ideal constraints first, then progressively looser ones. */
async function openStream(facing: CameraFacing, deviceId?: string): Promise<MediaStream> {
    const size = { width: { ideal: 1920 }, height: { ideal: 1440 } };
    const attempts: MediaTrackConstraints[] = deviceId
        ? [{ deviceId: { exact: deviceId }, ...size }, { deviceId: { exact: deviceId } }]
        : [{ facingMode: { ideal: facing }, ...size }, { facingMode: { ideal: facing } }, {}];

    let lastError: unknown = null;

    for (const video of attempts) {
        try {
            return await navigator.mediaDevices.getUserMedia({ video: Object.keys(video).length ? video : true, audio: false });
        } catch (error) {
            lastError = error;

            // Permission problems will not change with looser constraints.
            if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
                break;
            }
        }
    }

    throw lastError;
}

/**
 * The booth camera: one live stream at a time (iOS cannot hold two), with
 * front/back selection that survives browsers ignoring facingMode, restart on
 * return from the background, and plain-language errors.
 */
export function useCamera(initialFacing: CameraFacing = 'user'): CameraState {
    const [status, setStatus] = useState<CameraStatus>('idle');
    const [error, setError] = useState<CameraError | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [facing, setFacing] = useState<CameraFacing>(initialFacing);
    const [canSwitch, setCanSwitch] = useState(false);

    const streamRef = useRef<MediaStream | null>(null);
    const requestId = useRef(0);
    const wantedFacing = useRef<CameraFacing>(initialFacing);
    const active = useRef(false);

    const stop = useCallback(() => {
        active.current = false;
        requestId.current += 1;
        stopStream(streamRef.current);
        streamRef.current = null;
        setStream(null);
        setStatus('idle');
    }, []);

    const start = useCallback(async (requested: CameraFacing = wantedFacing.current) => {
        if (!window.isSecureContext) {
            setStatus('unsupported');
            setError({ kind: 'insecure', message: ERROR_COPY.insecure });

            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus('unsupported');
            setError({ kind: 'not-found', message: ERROR_COPY['not-found'] });

            return;
        }

        const id = ++requestId.current;
        active.current = true;
        wantedFacing.current = requested;
        setStatus('starting');
        setError(null);

        // Release the old camera first: iOS cannot open a second stream.
        stopStream(streamRef.current);
        streamRef.current = null;
        setStream(null);

        try {
            let next = await openStream(requested);
            let actual = detectFacing(next, requested);

            // Some browsers ignore facingMode: pick the other camera by its label, or any other device.
            if (actual !== null && actual !== requested) {
                const devices = await videoInputs();
                const currentId = next.getVideoTracks()[0]?.getSettings().deviceId;
                const pattern = requested === 'user' ? FRONT_LABEL : BACK_LABEL;
                const match = devices.find((device) => pattern.test(device.label)) ?? devices.find((device) => device.deviceId !== currentId);

                if (match && match.deviceId !== currentId) {
                    stopStream(next);
                    next = await openStream(requested, match.deviceId);
                    actual = detectFacing(next, requested) ?? requested;
                }
            }

            if (id !== requestId.current) {
                stopStream(next);

                return;
            }

            void boostLowLight(next.getVideoTracks()[0]);
            streamRef.current = next;
            setStream(next);
            setFacing(actual ?? requested);
            setStatus('ready');
            setCanSwitch((await videoInputs()).length > 1);
        } catch (caught) {
            if (id !== requestId.current) {
                return;
            }

            setStatus('error');
            setError(toCameraError(caught));
        }
    }, []);

    const switchCamera = useCallback(() => start(facing === 'user' ? 'environment' : 'user'), [facing, start]);

    const capture = useCallback(
        (video: HTMLVideoElement, aspect: number) =>
            captureShot({
                video,
                track: streamRef.current?.getVideoTracks()[0] ?? null,
                aspect,
                mirror: facing === 'user',
            }),
        [facing],
    );

    // Phones may kill the camera while the app is in the background.
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState !== 'visible' || !active.current) {
                return;
            }

            const track = streamRef.current?.getVideoTracks()[0];

            if (!track || track.readyState === 'ended') {
                void start(wantedFacing.current);
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [start]);

    useEffect(
        () => () => {
            requestId.current += 1;
            stopStream(streamRef.current);
        },
        [],
    );

    return { status, error, stream, facing, canSwitch, start, switchCamera, capture, stop };
}
