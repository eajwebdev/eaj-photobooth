<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;

/**
 * Event settings stored as key → JSON value rows, cached as one array.
 *
 * Values missing from the database fall back to config/photobooth.php so a
 * fresh install works before the seeder has run.
 */
class Settings
{
    public const CACHE_KEY = 'photobooth.settings';

    /**
     * Keys that must never leave the server.
     *
     * @var list<string>
     */
    public const SECRET_KEYS = ['admin_pin_hash', 'keepsake_pin_hash', 'gallery_code'];

    /**
     * @var array<string, mixed>|null
     */
    private ?array $resolved = null;

    /**
     * First-run defaults built from config/photobooth.php.
     *
     * @return array<string, mixed>
     */
    public function defaults(): array
    {
        $config = config('photobooth');

        return [
            'couple' => $config['couple'],
            'wedding_date' => $config['wedding_date'],
            'venue' => $config['venue'],
            'hashtag' => $config['hashtag'],
            'thank_you_message' => $config['thank_you_message'],
            'share_url' => $config['share_url'],
            'download_prefix' => $config['download_prefix'],
            'countdown_seconds' => $config['countdown_seconds'],
            'modes' => $config['modes'],
            'looks' => $config['looks'],
            'default_look' => $config['default_look'],
            'look_picker_enabled' => $config['look_picker_enabled'],
            'sounds_enabled' => $config['sounds_enabled'],
            'front_flash_enabled' => $config['front_flash_enabled'],
            'gallery_access' => $config['gallery_access'],
            'gallery_code' => $config['gallery_code'],
            'allow_zip_downloads' => $config['allow_zip_downloads'],
            'after_wedding_mode' => $config['after_wedding_mode'],
            'modules' => $config['modules'],
            'pose_prompts' => $config['pose_prompts'],
            'quiz_revealed_at' => null,
            'mosaic_revealed_at' => null,
            'admin_pin_hash' => null,
            'keepsake_pin_hash' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return $this->resolved ??= array_replace(
            $this->defaults(),
            Cache::rememberForever(self::CACHE_KEY, fn (): array => Setting::query()->pluck('value', 'key')->all()),
        );
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return Arr::get($this->all(), $key, $default);
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function setMany(array $values): void
    {
        foreach ($values as $key => $value) {
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }

        $this->flush();
    }

    public function set(string $key, mixed $value): void
    {
        $this->setMany([$key => $value]);
    }

    public function setPin(string $kind, string $pin): void
    {
        $this->set($kind.'_pin_hash', Hash::make($pin));
    }

    /**
     * Constant-time PIN check against the stored hash.
     */
    public function pinMatches(string $kind, ?string $pin): bool
    {
        $hash = $this->get($kind.'_pin_hash');

        if (! is_string($hash) || $hash === '' || $pin === null || $pin === '') {
            return false;
        }

        return Hash::check($pin, $hash);
    }

    public function galleryCodeMatches(?string $code): bool
    {
        $expected = $this->get('gallery_code');

        if (! is_string($expected) || $expected === '' || $code === null) {
            return false;
        }

        return hash_equals(mb_strtolower(trim($expected)), mb_strtolower(trim($code)));
    }

    public function galleryRequiresCode(): bool
    {
        return $this->get('gallery_access') === 'code';
    }

    /**
     * Settings safe to send to every browser.
     *
     * @return array<string, mixed>
     */
    public function public(): array
    {
        return Arr::except($this->all(), self::SECRET_KEYS);
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
        $this->resolved = null;
    }
}
