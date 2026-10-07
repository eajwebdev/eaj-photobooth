<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Services\Settings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SettingsSeeder extends Seeder
{
    /**
     * Writes first-run defaults for any setting not yet stored. PINs from .env
     * are stored hashed, never in plain text.
     */
    public function run(Settings $settings): void
    {
        $existing = Setting::query()->pluck('key')->all();
        $defaults = $settings->defaults();

        foreach (['admin', 'keepsake'] as $kind) {
            $pin = config("photobooth.{$kind}_pin");
            $defaults["{$kind}_pin_hash"] = is_string($pin) && $pin !== '' ? Hash::make($pin) : null;
        }

        $missing = array_diff_key($defaults, array_flip($existing));
        $missing = array_filter($missing, fn (mixed $value): bool => $value !== null);

        if ($missing !== []) {
            $settings->setMany($missing);
        }

        if (! in_array('admin_pin_hash', $existing, true) && ! isset($missing['admin_pin_hash'])) {
            $this->command?->warn('No admin PIN set. Add PHOTOBOOTH_ADMIN_PIN to .env and run php artisan db:seed again.');
        }
    }
}
