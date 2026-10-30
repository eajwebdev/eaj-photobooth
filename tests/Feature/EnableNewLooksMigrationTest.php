<?php

use App\Services\Settings;

/**
 * Runs the migration that switches the new looks on for an already-configured booth.
 */
function runEnableNewLooksMigration(string $direction = 'up'): void
{
    $migration = require database_path('migrations/2026_10_08_202100_enable_new_looks_in_settings.php');
    $migration->{$direction}();
}

it('switches the new looks on for a booth whose admin saved the original four', function () {
    $settings = app(Settings::class);
    $settings->setMany(['looks' => ['classic', 'noir'], 'default_look' => 'noir']);

    runEnableNewLooksMigration();

    expect($settings->get('looks'))->toContain('classic', 'noir', 'vintage', 'heirloom', 'silver')
        ->toHaveCount(14)
        ->and($settings->get('default_look'))->toBe('noir');
});

it('leaves a booth on the config defaults alone', function () {
    runEnableNewLooksMigration();

    expect(app(Settings::class)->get('looks'))->toBe(config('photobooth.looks'));
});

it('removes only the new looks when rolled back', function () {
    $settings = app(Settings::class);
    $settings->setMany(['looks' => ['classic', 'vintage'], 'default_look' => 'vintage']);

    runEnableNewLooksMigration('down');

    expect($settings->get('looks'))->toBe(['classic'])
        ->and($settings->get('default_look'))->toBe('classic');
});
