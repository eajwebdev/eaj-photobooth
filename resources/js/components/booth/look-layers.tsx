import type { Look } from '@/lib/looks';

/** The live stand-ins for a look's tint, fade, light leak, vignette and grain, stacked over a photo or video. */
export function LookLayers({ look }: { look: Look }) {
    return (
        <>
            {look.overlays.map((style, index) => (
                <span key={index} aria-hidden="true" className="pointer-events-none absolute inset-0" style={style} />
            ))}
        </>
    );
}
