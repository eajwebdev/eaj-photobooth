<?php

use App\Services\Settings;
use Database\Seeders\DatabaseSeeder;

it('shares public settings without any secrets', function () {
    $settings = app(Settings::class);
    $settings->setPin('admin', '2468');
    $settings->setPin('keepsake', '1225');
    $settings->set('gallery_code', 'Mahal2026');

    $response = $this->getJson('/api/settings/public');

    $response->assertOk()
        ->assertJsonPath('data.couple.short', 'Edwin & Jochel')
        ->assertJsonPath('data.countdown_seconds', 3)
        ->assertJsonMissingPath('data.admin_pin_hash')
        ->assertJsonMissingPath('data.keepsake_pin_hash')
        ->assertJsonMissingPath('data.gallery_code');
});

it('seeds the defaults and stores the env PINs hashed', function () {
    config(['photobooth.admin_pin' => '9753', 'photobooth.keepsake_pin' => '8642']);

    $this->seed(DatabaseSeeder::class);

    $settings = app(Settings::class);
    $settings->flush();
    expect($settings->get('admin_pin_hash'))->not->toBe('9753')
        ->and($settings->pinMatches('admin', '9753'))->toBeTrue()
        ->and($settings->pinMatches('keepsake', '8642'))->toBeTrue()
        ->and($settings->get('pose_prompts.fil'))->toContain('Ngiti naman diyan!');
    $this->assertDatabaseCount('layouts', 20);
    $this->assertDatabaseCount('challenges', 10);
});

it('never overwrites settings edited in admin when seeding again', function () {
    $this->seed(DatabaseSeeder::class);
    app(Settings::class)->set('hashtag', '#JochelSaidYes');

    $this->seed(DatabaseSeeder::class);

    $settings = app(Settings::class);
    $settings->flush();
    expect($settings->get('hashtag'))->toBe('#JochelSaidYes');
});
