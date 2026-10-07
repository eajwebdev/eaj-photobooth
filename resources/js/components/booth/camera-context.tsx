import { useCamera, type CameraState } from '@/hooks/use-camera';
import { createContext, useContext, type ReactNode } from 'react';

const CameraContext = createContext<CameraState | null>(null);

/** One camera stream for the whole booth session, shared by every screen that shows it. */
export function CameraProvider({ children }: { children: ReactNode }) {
    const camera = useCamera('user');

    return <CameraContext.Provider value={camera}>{children}</CameraContext.Provider>;
}

export function useBoothCamera(): CameraState {
    const camera = useContext(CameraContext);

    if (camera === null) {
        throw new Error('useBoothCamera must be used inside <CameraProvider>.');
    }

    return camera;
}
