import type { CameraFacing } from '@/hooks/use-camera';
import type { Rect } from '@/lib/capture-geometry';
import type { Look } from '@/lib/looks';
import { cn } from '@/lib/utils';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react';

interface CameraVideoProps {
    stream: MediaStream | null;
    facing: CameraFacing;
    look?: Look;
    /** Exact on-screen placement (capture screen); otherwise the video covers its box. */
    rect?: Rect | null;
    className?: string;
    onVideoSize?: (size: { w: number; h: number }) => void;
}

/**
 * A live camera view. Front camera is mirrored like a mirror; the back camera
 * never is. The look is a CSS filter plus optional tint and vignette.
 * Memoised so countdown re-renders never touch the video element.
 */
export const CameraVideo = memo(
    forwardRef<HTMLVideoElement | null, CameraVideoProps>(function CameraVideo({ stream, facing, look, rect, className, onVideoSize }, ref) {
        const videoRef = useRef<HTMLVideoElement>(null);

        useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement, []);

        useEffect(() => {
            const video = videoRef.current;

            if (!video) {
                return;
            }

            if (video.srcObject !== stream) {
                video.srcObject = stream;
            }

            if (stream) {
                void video.play().catch(() => undefined);
            }
        }, [stream]);

        useEffect(() => {
            const video = videoRef.current;

            if (!video || !onVideoSize) {
                return;
            }

            const report = () => {
                if (video.videoWidth && video.videoHeight) {
                    onVideoSize({ w: video.videoWidth, h: video.videoHeight });
                }
            };

            report();
            video.addEventListener('loadedmetadata', report);
            video.addEventListener('resize', report);

            return () => {
                video.removeEventListener('loadedmetadata', report);
                video.removeEventListener('resize', report);
            };
        }, [onVideoSize]);

        const placement: CSSProperties = rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : { inset: 0 };

        return (
            <div className={cn('bg-navy relative overflow-hidden', className)}>
                <div className="absolute overflow-hidden" style={placement}>
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        disablePictureInPicture
                        className="absolute inset-0 size-full object-cover"
                        style={{ filter: look?.cssFilter, transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
                    />
                    {look?.overlay && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={look.overlay} />}
                    {look && look.vignette > 0 && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0"
                            style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / ${look.vignette}) 100%)` }}
                        />
                    )}
                </div>
            </div>
        );
    }),
);
