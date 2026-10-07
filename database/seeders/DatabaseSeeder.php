<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database. Safe to run again at any time:
     * it never overwrites settings, frame switches or challenges edited in admin.
     */
    public function run(): void
    {
        $this->call([
            SettingsSeeder::class,
            LayoutSeeder::class,
            ChallengeSeeder::class,
        ]);
    }
}
