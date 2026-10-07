import { IconButton } from '@/components/chapel/icon-button';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface BoothHeaderProps {
    title: string;
    onBack: () => void;
    backLabel?: string;
    trailing?: ReactNode;
}

/** The booth's top bar: back on the left, the step's question in the middle. */
export function BoothHeader({ title, onBack, backLabel = 'Back', trailing }: BoothHeaderProps) {
    return (
        <header className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
            <IconButton aria-label={backLabel} variant="frosted" onClick={onBack}>
                <ChevronLeft />
            </IconButton>
            <h1 className="font-display text-gold-light text-center text-[clamp(1.6rem,4.2vw,2.6rem)] leading-tight italic">{title}</h1>
            <div className="flex justify-end">{trailing}</div>
        </header>
    );
}
