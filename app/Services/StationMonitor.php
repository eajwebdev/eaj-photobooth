<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Last reported upload backlog per booth device (kept for a day in the cache).
 */
class StationMonitor
{
    private const CACHE_KEY = 'photobooth.stations';

    public function record(string $station, int $waiting, int $failed): void
    {
        $all = $this->all();
        $all[$station] = ['waiting' => $waiting, 'failed' => $failed, 'last_seen' => now()->toIso8601String()];

        Cache::put(self::CACHE_KEY, $all, now()->addDay());
    }

    /**
     * @return array<string, array{waiting: int, failed: int, last_seen: string}>
     */
    public function all(): array
    {
        return Cache::get(self::CACHE_KEY, []);
    }
}
