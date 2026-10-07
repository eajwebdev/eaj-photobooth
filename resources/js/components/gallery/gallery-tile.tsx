import { HeartButton } from '@/components/gallery/heart-button';
import { useInView } from '@/hooks/use-in-view';
import type { CaptureData } from '@/lib/captures';
import { cn } from '@/lib/utils';
import { Crown, Repeat } from 'lucide-react';
import { memo, useState, type CSSProperties } from 'react';

interface GalleryTileProps {
    capture: CaptureData;
    onOpen: (capture: CaptureData) => void;
    /** Show the heart button (the hearts module is on). */
    hearts?: boolean;
}

export function tileRatio(capture: Pick<CaptureData, 'width' | 'height'>): number {
    return capture.width && capture.height ? capture.height / capture.width : 1.5;
}

/**
 * One photo in the grid: the dominant colour fills the space until the 520px
 * thumbnail fades in. Boomerangs play (muted) only while they are on screen.
 */
export const GalleryTile = memo(function GalleryTile({ capture, onOpen, hearts = false }: GalleryTileProps) {
    const [loaded, setLoaded] = useState(false);
    const isVideo = capture.type === 'boomerang' && capture.mime.startsWith('video/');
    const ratio = tileRatio(capture);

    return (
        <div
            className="group relative w-full overflow-hidden rounded-[3px] shadow-[0_10px_24px_rgb(0_0_0/0.35)]"
            style={
                {
                    aspectRatio: `${capture.width ?? 2} / ${capture.height ?? 3}`,
                    backgroundColor: capture.dominant_color ?? '#132A63',
                    contentVisibility: 'auto',
                    containIntrinsicSize: `auto ${Math.round(260 * ratio)}px`,
                } as CSSProperties
            }
        >
            <button
                type="button"
                onClick={() => onOpen(capture)}
                aria-label={capture.guest_name ? `Open photo from ${capture.guest_name}` : 'Open photo'}
                className="focus-visible:outline-gold-light absolute inset-0 block size-full transition-transform duration-200 active:scale-[0.985]"
            >
                <img
                    src={capture.urls.thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onLoad={() => setLoaded(true)}
                    className={cn('absolute inset-0 size-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
                />

                {isVideo && <LoopWhileVisible src={capture.urls.media} />}

                {capture.type === 'boomerang' && (
                    <span className="frosted absolute top-2 left-2 flex size-8 items-center justify-center rounded-full" aria-hidden="true">
                        <Repeat className="text-gold-light size-4" />
                    </span>
                )}

                {capture.is_couple_favourite && (
                    <span
                        className="frosted absolute top-2 right-2 flex size-8 items-center justify-center rounded-full"
                        title="The couple's favourite"
                    >
                        <Crown className="text-gold size-4" aria-label="The couple's favourite" />
                    </span>
                )}

                {capture.guest_name && (
                    <span className="font-display absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pr-16 pb-2 text-left text-sm text-white italic">
                        {capture.guest_name}
                    </span>
                )}
            </button>

            {hearts && (
                <span className="absolute right-2 bottom-2">
                    <HeartButton uuid={capture.uuid} count={capture.hearts_count ?? 0} />
                </span>
            )}
        </div>
    );
});

/** Plays a boomerang only while it is on screen, so a long gallery stays light. */
function LoopWhileVisible({ src }: { src: string }) {
    const [ref, inView] = useInView<HTMLSpanElement>('120px');

    return (
        <span ref={ref} className="absolute inset-0" aria-hidden="true">
            {inView && <video src={src} autoPlay loop muted playsInline preload="metadata" className="size-full object-cover" />}
        </span>
    );
}
