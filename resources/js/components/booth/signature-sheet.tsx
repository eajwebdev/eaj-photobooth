import { GhostButton, GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

const INK = '#A07C2C';

interface SignatureSheetProps {
    open: boolean;
    onDone: (signature: Blob) => void;
    onClose: () => void;
}

function dataUrlToBlob(dataUrl: string): Blob {
    const [header, data] = dataUrl.split(',');
    const mime = /data:(.*?);/.exec(header)?.[1] ?? 'image/png';
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));

    return new Blob([bytes], { type: mime });
}

/** Sign the guestbook with a finger: gold ink on a white card, saved as a transparent PNG. */
export function SignatureSheet({ open, onDone, onClose }: SignatureSheetProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const titleId = useId();

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!open || !canvas) {
            return;
        }

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);

        const pad = new SignaturePad(canvas, { penColor: INK, minWidth: 1.2, maxWidth: 3.4, backgroundColor: 'rgba(0,0,0,0)' });
        pad.addEventListener('endStroke', () => setIsEmpty(pad.isEmpty()));
        padRef.current = pad;
        setIsEmpty(true);

        return () => {
            pad.off();
            padRef.current = null;
        };
    }, [open]);

    const clear = () => {
        padRef.current?.clear();
        setIsEmpty(true);
    };

    const done = () => {
        const pad = padRef.current;

        if (!pad || pad.isEmpty()) {
            return;
        }

        onDone(dataUrlToBlob(pad.toDataURL('image/png')));
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="bg-navy/75 fixed inset-0 z-50 flex items-end justify-center p-3 backdrop-blur-sm sm:items-center sm:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className="border-gold-light/25 bg-navy-2 flex w-full max-w-2xl flex-col gap-5 rounded-[1.75rem] border p-5 sm:p-7"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 40, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    >
                        <div className="flex flex-col items-center gap-2 text-center">
                            <h2 id={titleId} className="font-display text-gold-light text-3xl italic">
                                Sign the guestbook
                            </h2>
                            <GoldOrnament width="w-10" />
                            <p className="text-mist/75 text-sm">Use your finger to sign. It goes into the couple’s guestbook next to your photo.</p>
                        </div>

                        <div className="relative rounded-2xl bg-white shadow-inner">
                            <canvas
                                ref={canvasRef}
                                aria-label="Signature area"
                                className="block h-[min(38dvh,16rem)] w-full touch-none rounded-2xl"
                            />
                            <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 bottom-12 border-b border-[#C9A14A]/45" />
                            {isEmpty && (
                                <span
                                    aria-hidden="true"
                                    className="font-display pointer-events-none absolute inset-x-0 bottom-16 text-center text-xl text-[#A07C2C]/45 italic"
                                >
                                    Sign here
                                </span>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <GhostButton type="button" onClick={clear} disabled={isEmpty} className="flex-1">
                                Clear
                            </GhostButton>
                            <GhostButton type="button" onClick={onClose} className="flex-1">
                                Cancel
                            </GhostButton>
                            <GoldButton type="button" onClick={done} disabled={isEmpty} className="flex-[1.4]">
                                Done
                            </GoldButton>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
