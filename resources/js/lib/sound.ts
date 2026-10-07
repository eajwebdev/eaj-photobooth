import { getAudioContext, unlockAudio } from '@/lib/audio';

/**
 * Soft countdown beeps and a shutter sound, synthesised with Web Audio so
 * nothing has to download. Silent until audio was unlocked by a tap.
 */
function context(): AudioContext | null {
    unlockAudio();
    const audio = getAudioContext();

    return audio && audio.state !== 'closed' ? audio : null;
}

function tone(frequency: number, durationMs: number, volume: number): void {
    const audio = context();

    if (!audio) {
        return;
    }

    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.02);
}

/** A gentle tick for 3, 2, 1. */
export function playCountdownBeep(): void {
    tone(880, 120, 0.12);
}

/** A soft mechanical shutter: two short filtered noise clicks. */
export function playShutter(): void {
    const audio = context();

    if (!audio) {
        return;
    }

    const length = Math.floor(audio.sampleRate * 0.09);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        const envelope = i < length * 0.35 ? 1 - i / (length * 0.35) : 0.55 * (1 - (i - length * 0.35) / (length * 0.65));
        data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();

    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.8;
    gain.gain.value = 0.35;

    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
}
