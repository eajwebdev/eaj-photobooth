<?php

use App\Models\Layout;
use Database\Seeders\LayoutSeeder;

it('seeds all 20 frames from layouts.json with their shot counts', function () {
    $this->seed(LayoutSeeder::class);

    expect(Layout::query()->count())->toBe(20)
        ->and(Layout::query()->where('slug', 'grid-6')->value('shots'))->toBe(6)
        ->and(Layout::query()->where('slug', 'film-strip-4')->value('category'))->toBe('strips')
        ->and(Layout::query()->where('slug', 'wish-card')->first()->text)->toBe(['y' => 1130, 'h' => 380]);
});

it('keeps a frame switched off when the seeder runs again', function () {
    $this->seed(LayoutSeeder::class);
    Layout::query()->where('slug', 'grid-4')->update(['is_active' => false]);

    $this->seed(LayoutSeeder::class);

    expect(Layout::query()->count())->toBe(20)
        ->and(Layout::query()->where('slug', 'grid-4')->value('is_active'))->toBeFalse();
});

it('lists only active frames in their seeded order', function () {
    $this->seed(LayoutSeeder::class);
    Layout::query()->where('slug', 'hero-duo')->update(['is_active' => false]);

    $response = $this->getJson('/api/layouts');

    $response->assertOk()
        ->assertJsonCount(19, 'data')
        ->assertJsonPath('data.0.slug', 'classic-portrait')
        ->assertJsonPath('data.0.canvas', ['w' => 1200, 'h' => 1800]);
    expect(collect($response->json('data'))->pluck('slug'))->not->toContain('hero-duo');
});
