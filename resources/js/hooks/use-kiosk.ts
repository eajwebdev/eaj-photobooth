import { unlockAudio } from '@/lib/audio';
import { useEffect } from 'react';

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };

let firstTapHandled = false;

function isAndroid(): boolean {
    return /android/i.test(navigator.userAgent);
}

/**
 * Booth-device behaviour: keep the screen awake, and on the first tap unlock
 * audio and (on Android) go fullscreen. iOS has no fullscreen for pages;
 * staff use Guided Access and "Add to Home Screen" there instead.
 */
export function useKiosk(): void {
    useEffect(() => {
        const nav = navigator as NavigatorWithWakeLock;
        let sentinel: WakeLockSentinelLike | null = null;
        let disposed = false;

        const requestWakeLock = async () => {
            if (!nav.wakeLock || document.visibilityState !== 'visible') {
                return;
            }

            try {
                sentinel = await nav.wakeLock.request('screen');

                if (disposed) {
                    void sentinel.release();
                }
            } catch {
                // Battery saver or an unsupported browser: the screen may dim.
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && (sentinel === null || sentinel.released)) {
                void requestWakeLock();
            }
        };

        const onContextMenu = (event: Event) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-saveable]')) {
                event.preventDefault();
            }
        };

        void requestWakeLock();
        document.addEventListener('visibilitychange', onVisibilityChange);
        document.addEventListener('contextmenu', onContextMenu);

        return () => {
            disposed = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            document.removeEventListener('contextmenu', onContextMenu);
            void sentinel?.release().catch(() => undefined);
        };
    }, []);

    useEffect(() => {
        if (firstTapHandled) {
            return;
        }

        const onFirstTap = () => {
            firstTapHandled = true;
            unlockAudio();

            if (isAndroid() && !document.fullscreenElement && document.documentElement.requestFullscreen) {
                void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
            }
        };

        window.addEventListener('pointerdown', onFirstTap, { once: true, capture: true });

        return () => window.removeEventListener('pointerdown', onFirstTap, { capture: true });
    }, []);
}
