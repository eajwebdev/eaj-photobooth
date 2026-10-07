import { formatWeddingDate } from '@/lib/format';
import { archPath, footerMetrics, polaroidBox, type Layout, type LayoutSlot } from '@/lib/layouts';
import { cn } from '@/lib/utils';
import type { PhotoboothSettings, SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { memo, useId, type ReactNode } from 'react';

const GOLD = '#C9A14A';
const GOLD_LIGHT = '#E8D29B';
const NAVY = '#0C1C45';
const ROYAL = '#1F3F95';
const DISPLAY = "'Bodoni Moda', Georgia, serif";
const SANS = "'Jost', system-ui, sans-serif";

interface LayoutPreviewProps {
    layout: Layout;
    /** Photos per slot (object URLs or /storage paths); empty slots show a placeholder. */
    images?: (string | null | undefined)[];
    /** Highlight one slot, e.g. the photo being taken next. */
    activeSlot?: number;
    guestName?: string | null;
    wish?: string | null;
    className?: string;
    /** Unsaved settings to preview (the admin settings editor). */
    settings?: Pick<PhotoboothSettings, 'couple' | 'wedding_date' | 'hashtag'>;
}

/**
 * A faithful SVG miniature of a collage frame, drawn from the same layout data
 * as the saved image. Used in the frame picker, the camera's corner preview and
 * while the final collage is composed.
 */
export const LayoutPreview = memo(function LayoutPreview({
    layout,
    images = [],
    activeSlot,
    guestName,
    wish,
    className,
    settings,
}: LayoutPreviewProps) {
    const shared = usePage<SharedData>().props.photobooth;
    const photobooth = settings ?? shared;
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const { w, h } = layout.canvas;
    const isDark = layout.theme !== 'white';
    const style = layout.style;

    const brand = {
        groom: photobooth.couple.groom_short,
        bride: photobooth.couple.bride_short,
        date: formatWeddingDate(photobooth.wedding_date, { weekday: undefined, month: 'long' }),
        hashtag: photobooth.hashtag,
    };

    return (
        <svg
            viewBox={`0 0 ${w} ${h}`}
            className={cn('block h-auto w-full', className)}
            role="img"
            aria-label={`${layout.name} frame`}
            preserveAspectRatio="xMidYMid meet"
        >
            <defs>
                <linearGradient id={`royal-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ROYAL} />
                    <stop offset="100%" stopColor={NAVY} />
                </linearGradient>
                <linearGradient id={`ph-light-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E3E8F3" />
                    <stop offset="100%" stopColor="#B9C3DC" />
                </linearGradient>
                <linearGradient id={`ph-dark-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34509F" />
                    <stop offset="100%" stopColor="#16296A" />
                </linearGradient>
                <linearGradient id={`mag-top-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity="0.92" />
                    <stop offset="100%" stopColor={NAVY} stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`mag-bottom-${uid}`} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor={NAVY} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={NAVY} stopOpacity="0" />
                </linearGradient>
                <pattern id={`dots-${uid}`} width="22" height="22" patternUnits="userSpaceOnUse">
                    <circle cx="11" cy="11" r="1.4" fill={GOLD} fillOpacity="0.16" />
                </pattern>
                <filter id={`shadow-${uid}`} x="-10%" y="-10%" width="120%" height="125%">
                    <feDropShadow dx="0" dy={w * 0.008} stdDeviation={w * 0.01} floodColor="#000" floodOpacity="0.35" />
                </filter>
                {layout.slots.map((slot, index) => (
                    <clipPath key={index} id={`clip-${uid}-${index}`}>
                        <SlotShape slot={slot} />
                    </clipPath>
                ))}
            </defs>

            <Background layout={layout} uid={uid} />

            {layout.slots.map((slot, index) => (
                <Slot
                    key={index}
                    layout={layout}
                    slot={slot}
                    index={index}
                    uid={uid}
                    image={images[index] ?? null}
                    active={activeSlot === index}
                    isDark={isDark}
                    postmarkDate={formatWeddingDate(photobooth.wedding_date, { weekday: undefined, month: 'short' })}
                />
            ))}

            {style === 'magazine' && <MagazineCover layout={layout} uid={uid} brand={brand} guestName={guestName} />}
            {style === 'wishcard' && layout.text && <WishText layout={layout} wish={wish} guestName={guestName} />}
            {style === 'heirloom' && <HeirloomCaption layout={layout} />}

            <Footer layout={layout} brand={brand} isDark={isDark} />
        </svg>
    );
});

function SlotShape({ slot }: { slot: LayoutSlot }) {
    if (slot.shape === 'arch') {
        return <path d={archPath(slot)} />;
    }

    if (slot.shape === 'circle') {
        return <ellipse cx={slot.x + slot.w / 2} cy={slot.y + slot.h / 2} rx={slot.w / 2} ry={slot.h / 2} />;
    }

    return <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} />;
}

function Background({ layout, uid }: { layout: Layout; uid: string }) {
    const { w, h } = layout.canvas;
    const scale = Math.min(w, h) / 1200;

    if (layout.style === 'cinema') {
        return <rect width={w} height={h} fill="#070F26" />;
    }

    if (layout.theme === 'film') {
        const holes: ReactNode[] = [];

        for (let y = 13; y + 18 <= h; y += 44) {
            holes.push(<rect key={`l${y}`} x={27} y={y} width={26} height={18} rx={4} fill="#F4F6FB" />);
            holes.push(<rect key={`r${y}`} x={w - 53} y={y} width={26} height={18} rx={4} fill="#F4F6FB" />);
        }

        return (
            <g>
                <rect width={w} height={h} fill={NAVY} />
                {holes}
            </g>
        );
    }

    if (layout.theme === 'royal') {
        return (
            <g>
                <rect width={w} height={h} fill={`url(#royal-${uid})`} />
                <rect width={w} height={h} fill={`url(#dots-${uid})`} />
                <DoubleFrame w={w} h={h} scale={scale} color={GOLD_LIGHT} />
            </g>
        );
    }

    return (
        <g>
            <rect width={w} height={h} fill={layout.style === 'heirloom' ? '#F6F7FB' : '#FFFFFF'} />
            <DoubleFrame w={w} h={h} scale={scale} color={GOLD} />
        </g>
    );
}

function DoubleFrame({ w, h, scale, color }: { w: number; h: number; scale: number; color: string }) {
    const outer = 18 * scale;
    const inner = 28 * scale;

    return (
        <g fill="none" stroke={color}>
            <rect x={outer} y={outer} width={w - outer * 2} height={h - outer * 2} strokeWidth={Math.max(3 * scale, 3)} />
            <rect x={inner} y={inner} width={w - inner * 2} height={h - inner * 2} strokeWidth={Math.max(1.2 * scale, 1.4)} />
        </g>
    );
}

interface SlotProps {
    layout: Layout;
    slot: LayoutSlot;
    index: number;
    uid: string;
    image: string | null;
    active: boolean;
    isDark: boolean;
    postmarkDate: string | null;
}

function Slot({ layout, slot, index, uid, image, active, isDark, postmarkDate }: SlotProps) {
    const cx = slot.x + slot.w / 2;
    const cy = slot.y + slot.h / 2;
    const rotate = slot.r ? `rotate(${slot.r} ${cx} ${cy})` : undefined;
    const lineColor = isDark ? GOLD_LIGHT : GOLD;
    const style = layout.style;

    return (
        <g transform={rotate}>
            {style === 'polaroid' && <PolaroidBorder slot={slot} uid={uid} />}
            {style === 'heirloom' && <HeirloomMount slot={slot} uid={uid} />}
            {style === 'stamp' && <StampBorder slot={slot} uid={uid} index={index} postmarkDate={postmarkDate} />}

            <g clipPath={`url(#clip-${uid}-${index})`}>
                {image ? (
                    <image href={image} x={slot.x} y={slot.y} width={slot.w} height={slot.h} preserveAspectRatio="xMidYMid slice" />
                ) : (
                    <Placeholder slot={slot} uid={uid} dark={isDark && style !== 'polaroid' && style !== 'stamp'} />
                )}
            </g>

            <SlotOutline slot={slot} layout={layout} color={lineColor} />

            {style === 'cinema' && (
                <g>
                    <line x1={slot.x} x2={slot.x + slot.w} y1={slot.y - 10} y2={slot.y - 10} stroke={GOLD} strokeWidth={2} />
                    <line x1={slot.x} x2={slot.x + slot.w} y1={slot.y + slot.h + 10} y2={slot.y + slot.h + 10} stroke={GOLD} strokeWidth={2} />
                    <text x={slot.x + 18} y={slot.y + 36} fill={GOLD_LIGHT} style={{ fontFamily: SANS, fontSize: 22, letterSpacing: 3 }}>
                        Scene {index + 1}
                    </text>
                </g>
            )}

            {active && (
                <rect
                    x={slot.x - 6}
                    y={slot.y - 6}
                    width={slot.w + 12}
                    height={slot.h + 12}
                    fill="none"
                    stroke={GOLD}
                    strokeWidth={Math.max(layout.canvas.w, layout.canvas.h) * 0.008}
                    rx={slot.shape === 'circle' ? slot.w / 2 : 0}
                />
            )}
        </g>
    );
}

function SlotOutline({ slot, layout, color }: { slot: LayoutSlot; layout: Layout; color: string }) {
    if (
        layout.theme === 'film' ||
        layout.style === 'polaroid' ||
        layout.style === 'heirloom' ||
        layout.style === 'magazine' ||
        layout.style === 'stamp'
    ) {
        return null;
    }

    if (slot.shape === 'arch') {
        const outer = { x: slot.x - 14, y: slot.y - 14, w: slot.w + 28, h: slot.h + 28 };

        return (
            <g fill="none" stroke={color}>
                <path d={archPath(slot)} strokeWidth={3} />
                <path d={archPath(outer)} strokeWidth={1.5} />
            </g>
        );
    }

    if (slot.shape === 'circle') {
        const cx = slot.x + slot.w / 2;
        const cy = slot.y + slot.h / 2;

        return (
            <g fill="none" stroke={color}>
                <ellipse cx={cx} cy={cy} rx={slot.w / 2} ry={slot.h / 2} strokeWidth={4} />
                <ellipse cx={cx} cy={cy} rx={slot.w / 2 - 12} ry={slot.h / 2 - 12} strokeWidth={1.2} strokeOpacity={0.8} />
            </g>
        );
    }

    return <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill="none" stroke={color} strokeWidth={2.5} />;
}

/** A soft photo stand-in with a quiet two-person silhouette. */
function Placeholder({ slot, uid, dark }: { slot: LayoutSlot; uid: string; dark: boolean }) {
    const size = Math.min(slot.w, slot.h);
    const cx = slot.x + slot.w / 2;
    const base = slot.y + slot.h;
    const head = size * 0.11;
    const tone = dark ? '#5672BE' : '#97A5C8';

    return (
        <g>
            <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} fill={`url(#ph-${dark ? 'dark' : 'light'}-${uid})`} />
            <g fill={tone} fillOpacity={0.55}>
                <circle cx={cx - size * 0.13} cy={base - size * 0.42} r={head} />
                <circle cx={cx + size * 0.14} cy={base - size * 0.39} r={head * 0.92} />
                <path
                    d={`M${cx - size * 0.36} ${base} C${cx - size * 0.34} ${base - size * 0.26}, ${cx - size * 0.02} ${base - size * 0.3}, ${cx} ${base - size * 0.12} C${cx + size * 0.04} ${base - size * 0.28}, ${cx + size * 0.34} ${base - size * 0.24}, ${cx + size * 0.38} ${base} Z`}
                />
            </g>
        </g>
    );
}

function PolaroidBorder({ slot, uid }: { slot: LayoutSlot; uid: string }) {
    const box = polaroidBox(slot);

    return <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#FFFFFF" filter={`url(#shadow-${uid})`} />;
}

function HeirloomMount({ slot, uid }: { slot: LayoutSlot; uid: string }) {
    const border = 14;
    const x = slot.x - border;
    const y = slot.y - border;
    const w = slot.w + border * 2;
    const h = slot.h + border * 2;
    const corner = Math.min(slot.w, slot.h) * 0.12;

    return (
        <g>
            <rect x={x} y={y} width={w} height={h} fill="#FFFFFF" filter={`url(#shadow-${uid})`} />
            <g fill={GOLD}>
                <path d={`M${x} ${y} h${corner} L${x} ${y + corner} Z`} />
                <path d={`M${x + w} ${y} h${-corner} L${x + w} ${y + corner} Z`} />
                <path d={`M${x} ${y + h} h${corner} L${x} ${y + h - corner} Z`} />
                <path d={`M${x + w} ${y + h} h${-corner} L${x + w} ${y + h - corner} Z`} />
            </g>
        </g>
    );
}

/** A postage stamp: white border with perforated (scalloped) edges. */
function StampBorder({ slot, uid, index, postmarkDate }: { slot: LayoutSlot; uid: string; index: number; postmarkDate: string | null }) {
    const border = 26;
    const x = slot.x - border;
    const y = slot.y - border;
    const w = slot.w + border * 2;
    const h = slot.h + border * 2;
    const step = 22;
    const radius = 7;
    const holes: ReactNode[] = [];

    for (let px = x; px <= x + w; px += step) {
        holes.push(<circle key={`t${px}`} cx={px} cy={y} r={radius} />, <circle key={`b${px}`} cx={px} cy={y + h} r={radius} />);
    }

    for (let py = y; py <= y + h; py += step) {
        holes.push(<circle key={`l${py}`} cx={x} cy={py} r={radius} />, <circle key={`r${py}`} cx={x + w} cy={py} r={radius} />);
    }

    return (
        <g>
            <mask id={`stamp-${uid}-${index}`}>
                <rect x={x - radius} y={y - radius} width={w + radius * 2} height={h + radius * 2} fill="white" />
                <g fill="black">{holes}</g>
            </mask>
            <rect x={x} y={y} width={w} height={h} fill="#FFFFFF" mask={`url(#stamp-${uid}-${index})`} filter={`url(#shadow-${uid})`} />
            <text x={x + w - 34} y={y + h - 8} textAnchor="end" fill={GOLD} style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600 }}>
                ₱ 20
            </text>
            <text x={x + 34} y={y + h - 8} fill={ROYAL} style={{ fontFamily: DISPLAY, fontSize: 18, fontStyle: 'italic' }}>
                Mahal kita
            </text>
            {index === 0 && <Postmark cx={x + w - 20} cy={y + 20} date={postmarkDate} />}
        </g>
    );
}

/** A round gold postmark stamped over one corner. */
function Postmark({ cx, cy, date }: { cx: number; cy: number; date: string | null }) {
    return (
        <g opacity={0.9}>
            <circle cx={cx} cy={cy} r={72} fill="none" stroke={GOLD} strokeWidth={4} />
            <circle cx={cx} cy={cy} r={58} fill="none" stroke={GOLD} strokeWidth={1.5} />
            <text x={cx} y={cy - 8} textAnchor="middle" fill={GOLD} style={{ fontFamily: SANS, fontSize: 15, letterSpacing: 2 }}>
                {date ?? 'Just married'}
            </text>
            <text x={cx} y={cy + 18} textAnchor="middle" fill={GOLD} style={{ fontFamily: DISPLAY, fontSize: 22, fontStyle: 'italic' }}>
                E &amp; J
            </text>
            <path d={`M${cx - 110} ${cy + 46} q 20 -10 40 0 t 40 0 t 40 0 t 40 0 t 40 0`} fill="none" stroke={GOLD} strokeWidth={2} />
        </g>
    );
}

interface Brand {
    groom: string;
    bride: string;
    date: string | null;
    hashtag: string | null;
}

function MagazineCover({ layout, uid, brand, guestName }: { layout: Layout; uid: string; brand: Brand; guestName?: string | null }) {
    const { w, h } = layout.canvas;

    return (
        <g>
            <rect width={w} height={h * 0.3} fill={`url(#mag-top-${uid})`} />
            <rect y={h * 0.62} width={w} height={h * 0.38} fill={`url(#mag-bottom-${uid})`} />
            <text
                x={w / 2}
                y={h * 0.095}
                textAnchor="middle"
                fill="#FFFFFF"
                textLength={w * 0.86}
                lengthAdjust="spacingAndGlyphs"
                style={{ fontFamily: DISPLAY, fontSize: h * 0.075, fontWeight: 600 }}
            >
                {`${brand.groom} & ${brand.bride}`.toUpperCase()}
            </text>
            <text x={w / 2} y={h * 0.135} textAnchor="middle" fill={GOLD_LIGHT} style={{ fontFamily: SANS, fontSize: h * 0.016, letterSpacing: 4 }}>
                {brand.date ? `Wedding issue  ◆  ${brand.date}` : 'The wedding issue'}
            </text>
            <g fill="#FFFFFF" style={{ fontFamily: SANS }}>
                <text x={w * 0.07} y={h * 0.7} style={{ fontSize: h * 0.026, fontWeight: 500 }}>
                    {guestName ? `Starring ${guestName}` : 'Starring you'}
                </text>
                <text x={w * 0.07} y={h * 0.745} style={{ fontSize: h * 0.02 }}>
                    The happiest day of the year
                </text>
                <text x={w * 0.07} y={h * 0.785} style={{ fontSize: h * 0.02 }}>
                    Inside: 300 photos from the party
                </text>
            </g>
        </g>
    );
}

function WishText({ layout, wish, guestName }: { layout: Layout; wish?: string | null; guestName?: string | null }) {
    const box = layout.text;

    if (!box) {
        return null;
    }

    const cx = layout.canvas.w / 2;
    const text = wish?.trim() || 'Your wish for the couple goes here';

    return (
        <g textAnchor="middle">
            <text x={cx} y={box.y + box.h * 0.42} fill={NAVY} style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: box.h * 0.15 }}>
                {text.length > 44 ? `${text.slice(0, 42)}…` : text}
            </text>
            <text x={cx} y={box.y + box.h * 0.72} fill={ROYAL} style={{ fontFamily: SANS, fontSize: box.h * 0.085 }}>
                {`— ${guestName?.trim() || 'With love'}`}
            </text>
        </g>
    );
}

function HeirloomCaption({ layout }: { layout: Layout }) {
    const last = layout.slots[layout.slots.length - 1];

    if (!last) {
        return null;
    }

    return (
        <text
            x={last.x + last.w - 10}
            y={last.y + last.h + 54}
            textAnchor="end"
            fill={ROYAL}
            style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: 34 }}
        >
            Our wedding day
        </text>
    );
}

/** Ornament, names, date and hashtag, centred in the footer band. */
function Footer({ layout, brand, isDark }: { layout: Layout; brand: Brand; isDark: boolean }) {
    const { w } = layout.canvas;
    const { y, h } = layout.footer;
    const cx = w / 2;
    const ink = isDark ? '#EEF2FA' : NAVY;
    const accent = isDark ? GOLD_LIGHT : GOLD;
    const names = layout.style === 'cinema' ? `${brand.groom} & ${brand.bride} — a love story` : `${brand.groom} & ${brand.bride}`;

    if (layout.style === 'magazine') {
        return (
            <g textAnchor="middle" style={{ fontFamily: SANS }}>
                <text x={cx} y={y + h * 0.48} fill="#FFFFFF" style={{ fontSize: h * 0.13, letterSpacing: 4 }}>
                    {brand.date ?? ''}
                </text>
                <text x={cx} y={y + h * 0.74} fill={GOLD_LIGHT} style={{ fontSize: h * 0.12 }}>
                    {brand.hashtag ?? ''}
                </text>
            </g>
        );
    }

    const metrics = footerMetrics(layout);
    const ornamentY = y + h * (w < 800 ? 0.16 : metrics.ornamentY);
    const ornamentHalf = Math.min(w * 0.16, 150);
    const ornament = (
        <g stroke={accent} strokeWidth={2} fill="none">
            <line x1={cx - ornamentHalf} x2={cx - 16} y1={ornamentY} y2={ornamentY} />
            <line x1={cx + 16} x2={cx + ornamentHalf} y1={ornamentY} y2={ornamentY} />
            <path d={`M${cx} ${ornamentY - 8} L${cx + 8} ${ornamentY} L${cx} ${ornamentY + 8} L${cx - 8} ${ornamentY} Z`} fill={accent} />
        </g>
    );

    if (w < 800) {
        const size = h * 0.17;

        return (
            <g textAnchor="middle">
                {ornament}
                <text x={cx} y={y + h * 0.39} fill={ink} style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: size }}>
                    {brand.groom}
                </text>
                <text x={cx} y={y + h * 0.52} fill={accent} style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: size * 0.62 }}>
                    &amp;
                </text>
                <text x={cx} y={y + h * 0.69} fill={ink} style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: size }}>
                    {brand.bride}
                </text>
                {brand.date && (
                    <text x={cx} y={y + h * 0.83} fill={ink} style={{ fontFamily: SANS, fontWeight: 500, fontSize: h * 0.055, letterSpacing: 3 }}>
                        {brand.date}
                    </text>
                )}
                {brand.hashtag && (
                    <text x={cx} y={y + h * 0.94} fill={accent} style={{ fontFamily: SANS, fontSize: h * 0.055 }}>
                        {brand.hashtag}
                    </text>
                )}
            </g>
        );
    }

    const nameSize = Math.min(h * metrics.nameSize, (w * 0.84) / (names.length * 0.48));

    return (
        <g textAnchor="middle">
            {ornament}
            <text x={cx} y={y + h * metrics.nameY} fill={ink} style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontSize: nameSize }}>
                {names}
            </text>
            {brand.date && (
                <text
                    x={cx}
                    y={y + h * metrics.dateY}
                    fill={ink}
                    style={{ fontFamily: SANS, fontWeight: 500, fontSize: h * metrics.dateSize, letterSpacing: 4 }}
                >
                    {brand.date}
                </text>
            )}
            {brand.hashtag && (
                <text x={cx} y={y + h * metrics.tagY} fill={accent} style={{ fontFamily: SANS, fontSize: h * metrics.tagSize }}>
                    {brand.hashtag}
                </text>
            )}
        </g>
    );
}
