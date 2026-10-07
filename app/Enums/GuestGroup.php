<?php

namespace App\Enums;

/**
 * "Who are you?" on the review screen.
 */
enum GuestGroup: string
{
    case FamilyGroom = 'family-groom';
    case FamilyBride = 'family-bride';
    case NinongNinang = 'ninong-ninang';
    case Barkada = 'barkada';
    case Workmates = 'workmates';
    case Entourage = 'entourage';

    public function label(): string
    {
        return match ($this) {
            self::FamilyGroom => 'Family of the groom',
            self::FamilyBride => 'Family of the bride',
            self::NinongNinang => 'Ninong & Ninang',
            self::Barkada => 'Barkada',
            self::Workmates => 'Workmates',
            self::Entourage => 'Entourage',
        };
    }

    public static function labelFor(?string $value): ?string
    {
        return $value === null ? null : self::tryFrom($value)?->label();
    }
}
