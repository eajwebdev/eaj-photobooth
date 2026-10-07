import { GoldButton } from '@/components/chapel/gold-button';
import { GoldOrnament } from '@/components/chapel/gold-ornament';
import { Monogram } from '@/components/chapel/monogram';
import { useId, useState, type FormEvent } from 'react';

interface CodeGateProps {
    onSubmit: (code: string) => void;
    /** Shown after a wrong code. */
    rejected: boolean;
    checking: boolean;
}

/** When the couple keeps the gallery private: one code, remembered on the phone afterwards. */
export function CodeGate({ onSubmit, rejected, checking }: CodeGateProps) {
    const [code, setCode] = useState('');
    const inputId = useId();

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (code.trim()) {
            onSubmit(code.trim());
        }
    };

    return (
        <form onSubmit={submit} className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-6 text-center">
            <div className="w-20">
                <Monogram />
            </div>
            <h1 className="font-display text-gold-light text-4xl italic">Wedding photos</h1>
            <GoldOrnament width="w-10" />
            <label htmlFor={inputId} className="text-mist/80">
                Enter the wedding code from your invitation or table card.
            </label>
            <input
                id={inputId}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoCapitalize="none"
                autoComplete="off"
                autoFocus
                className="border-gold-light/35 bg-navy text-mist focus:border-gold h-14 w-full rounded-2xl border px-5 text-center text-lg tracking-wide focus:outline-none"
                aria-invalid={rejected}
                aria-describedby={rejected ? `${inputId}-error` : undefined}
            />
            {rejected && (
                <p id={`${inputId}-error`} role="alert" className="-mt-3 text-sm text-[#f0b3aa]">
                    That code is not right. Check the spelling and try again.
                </p>
            )}
            <GoldButton type="submit" size="lg" className="w-full" disabled={checking || !code.trim()}>
                {checking ? 'Checking…' : 'See the photos'}
            </GoldButton>
        </form>
    );
}
