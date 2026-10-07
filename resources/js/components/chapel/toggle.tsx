import { cn } from '@/lib/utils';
import { useId } from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    className?: string;
}

/** An on/off switch with its label; the whole row is the touch target. */
export function Toggle({ checked, onChange, label, description, disabled = false, className }: ToggleProps) {
    const descriptionId = useId();

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-describedby={description ? descriptionId : undefined}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn('flex min-h-12 w-full items-center justify-between gap-5 text-left disabled:opacity-45', className)}
        >
            <span className="flex flex-col gap-0.5">
                <span className="text-mist text-base">{label}</span>
                {description && (
                    <span id={descriptionId} className="text-mist/65 text-sm">
                        {description}
                    </span>
                )}
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    'ease-chapel relative inline-flex h-8 w-14 shrink-0 rounded-full border transition-colors duration-200',
                    checked ? 'border-gold-deep bg-gold-leaf' : 'border-gold-light/30 bg-navy-2',
                )}
            >
                <span
                    className={cn(
                        'ease-chapel absolute top-[3px] size-6 rounded-full shadow transition-transform duration-200',
                        checked ? 'bg-navy translate-x-[27px]' : 'bg-mist/80 translate-x-[3px]',
                    )}
                />
            </span>
        </button>
    );
}
