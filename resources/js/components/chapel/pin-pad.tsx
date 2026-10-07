import { GoldButton } from '@/components/chapel/gold-button';
import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';

interface PinPadProps {
    /** Resolves with an error to show, or null when the PIN was accepted. */
    onSubmit: (pin: string) => Promise<string | null>;
    title: string;
    hint?: string;
    submitLabel?: string;
    minLength?: number;
    maxLength?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** A large keypad for staff and couple PINs; works with touch and a keyboard. */
export function PinPad({ onSubmit, title, hint, submitLabel = 'Unlock', minLength = 4, maxLength = 8 }: PinPadProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const shake = useAnimationControls();
    const reduceMotion = useReducedMotion();

    const press = useCallback(
        (digit: string) => {
            setError(null);
            setPin((current) => (current.length < maxLength ? current + digit : current));
        },
        [maxLength],
    );

    const erase = useCallback(() => setPin((current) => current.slice(0, -1)), []);

    const submit = useCallback(async () => {
        if (pin.length < minLength || checking) {
            return;
        }

        setChecking(true);
        const message = await onSubmit(pin);
        setChecking(false);

        if (message !== null) {
            setError(message);
            setPin('');

            if (!reduceMotion) {
                void shake.start({ x: [0, -10, 10, -7, 7, 0], transition: { duration: 0.38 } });
            }
        }
    }, [checking, minLength, onSubmit, pin, reduceMotion, shake]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (/^\d$/.test(event.key)) {
                press(event.key);
            } else if (event.key === 'Backspace') {
                erase();
            } else if (event.key === 'Enter') {
                void submit();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, [erase, press, submit]);

    const keyClass =
        'flex size-[4.5rem] items-center justify-center rounded-full border border-gold-light/25 font-display text-[1.75rem] text-mist ' +
        'transition-[transform,background-color] duration-150 ease-chapel active:scale-[0.94] active:bg-gold-light/15 hover:bg-gold-light/5';

    return (
        <div className="flex w-full max-w-xs flex-col items-center gap-7">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-display text-gold-light text-3xl italic">{title}</h1>
                {hint && <p className="text-mist/70 text-sm">{hint}</p>}
            </div>

            <motion.div animate={shake} className="flex h-5 items-center gap-3.5" aria-live="polite">
                <span className="sr-only">{pin.length} digits entered</span>
                {Array.from({ length: Math.max(minLength, pin.length) }, (_, index) => (
                    <span
                        key={index}
                        aria-hidden="true"
                        className={cn(
                            'size-3.5 rounded-full border transition-colors duration-150',
                            index < pin.length ? 'border-gold bg-gold' : 'border-gold-light/45',
                        )}
                    />
                ))}
            </motion.div>

            <p role="alert" className="min-h-5 text-center text-sm text-[#f0b3aa]">
                {error}
            </p>

            <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                {KEYS.map((digit) => (
                    <button key={digit} type="button" className={keyClass} onClick={() => press(digit)}>
                        {digit}
                    </button>
                ))}
                <span aria-hidden="true" />
                <button type="button" className={keyClass} onClick={() => press('0')}>
                    0
                </button>
                <button
                    type="button"
                    aria-label="Delete last digit"
                    className={cn(keyClass, 'text-gold-light border-transparent [&_svg]:size-6 [&_svg]:stroke-[1.5]')}
                    onClick={erase}
                >
                    <Delete />
                </button>
            </div>

            <GoldButton type="button" className="w-full" disabled={pin.length < minLength || checking} onClick={() => void submit()}>
                {checking ? 'Checking…' : submitLabel}
            </GoldButton>
        </div>
    );
}
