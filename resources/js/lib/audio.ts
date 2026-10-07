let context: AudioContext | null = null;

type AudioContextConstructor = typeof AudioContext;

function audioContextClass(): AudioContextConstructor | null {
    const scope = window as typeof window & { webkitAudioContext?: AudioContextConstructor };

    return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/**
 * Browsers only allow sound after a tap. Call this from the first tap so the
 * countdown beeps and shutter sound can play later without another gesture.
 */
export function unlockAudio(): void {
    const Context = audioContextClass();

    if (Context === null) {
        return;
    }

    context ??= new Context();

    if (context.state === 'suspended') {
        void context.resume();
    }

    // A one-sample silent buffer completes the unlock on older iOS Safari.
    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
}

export function getAudioContext(): AudioContext | null {
    return context;
}
