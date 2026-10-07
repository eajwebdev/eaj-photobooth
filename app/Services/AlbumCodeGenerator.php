<?php

namespace App\Services;

use App\Models\Album;
use Illuminate\Support\Arr;
use RuntimeException;

/**
 * Readable album codes such as "ROSE-4821": a wedding word plus four digits
 * from 2–9, so nobody confuses 0 with O or 1 with I when typing it.
 */
class AlbumCodeGenerator
{
    private const DIGITS = '23456789';

    private const MAX_ATTEMPTS = 50;

    public function generate(): string
    {
        for ($attempt = 0; $attempt < self::MAX_ATTEMPTS; $attempt++) {
            $code = $this->candidate();

            if (! Album::query()->where('code', $code)->exists()) {
                return $code;
            }
        }

        throw new RuntimeException('Could not find a free album code.');
    }

    public function candidate(): string
    {
        $digits = '';

        for ($i = 0; $i < 4; $i++) {
            $digits .= self::DIGITS[random_int(0, strlen(self::DIGITS) - 1)];
        }

        return Arr::random(config('photobooth.album_words')).'-'.$digits;
    }
}
