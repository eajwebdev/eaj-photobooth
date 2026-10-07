<?php

namespace Database\Seeders;

use App\Models\Challenge;
use Illuminate\Database\Seeder;

class ChallengeSeeder extends Seeder
{
    /**
     * Adds the default photo challenges once; edits made in admin are kept.
     */
    public function run(): void
    {
        if (Challenge::query()->exists()) {
            return;
        }

        foreach (config('photobooth.challenges') as $index => $title) {
            Challenge::query()->create(['title' => $title, 'sort' => $index + 1, 'is_active' => true]);
        }
    }
}
