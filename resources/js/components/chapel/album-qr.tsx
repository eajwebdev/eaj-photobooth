import { cn } from '@/lib/utils';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface AlbumQrProps {
    url: string;
    label: string;
    className?: string;
}

/**
 * A QR code (navy on white) set in a chapel-window card with a gold double
 * outline, the arch motif from the monogram.
 */
export function AlbumQr({ url, label, className }: AlbumQrProps) {
    const [svg, setSvg] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;

        void QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0C1C45', light: '#FFFFFF' } }).then(
            (markup) => {
                if (alive) {
                    setSvg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
                }
            },
        );

        return () => {
            alive = false;
        };
    }, [url]);

    return (
        <div
            className={cn(
                'border-gold @container relative flex w-[min(62vw,15rem)] flex-col items-center rounded-t-[999px] rounded-b-2xl border-2 bg-white px-[9%] pt-[11%] pb-[9%]',
                'shadow-[0_0_0_5px_#0C1C45,0_0_0_6px_#E8D29B,0_18px_40px_rgb(0_0_0/0.4)]',
                className,
            )}
        >
            <span aria-hidden="true" className="font-display text-gold-deep mb-[5%] text-[8.5cqw] leading-none">
                E <span className="text-[6cqw] italic">&amp;</span> J
            </span>
            {svg ? (
                <img src={svg} alt={label} className="aspect-square w-full" />
            ) : (
                <span className="bg-mist aspect-square w-full animate-pulse rounded" aria-label="Making the QR code" />
            )}
        </div>
    );
}
