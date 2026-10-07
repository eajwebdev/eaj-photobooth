<?php

use App\Models\Capture;
use App\Models\Mosaic;
use App\Services\Settings;

it('tallies photos by table and by guest group', function () {
    Capture::factory()->count(3)->create(['table_no' => 7, 'group_tag' => 'barkada']);
    Capture::factory()->create(['table_no' => 2, 'group_tag' => 'family-bride']);
    Capture::factory()->hidden()->create(['table_no' => 2]);

    $response = $this->getJson('/api/party/state');

    $response->assertOk()
        ->assertJsonPath('data.tallies.tables.0', ['table' => 7, 'photos' => 3])
        ->assertJsonPath('data.tallies.tables.1', ['table' => 2, 'photos' => 1])
        ->assertJsonPath('data.tallies.groups.0.label', 'Barkada');
});

it('lists the most loved photos', function () {
    Capture::factory()->create(['hearts_count' => 2]);
    $favourite = Capture::factory()->create(['hearts_count' => 12]);

    $this->getJson('/api/party/state')->assertJsonPath('data.most_loved.0.uuid', $favourite->uuid);
});

it('leaves out modules the couple switched off', function () {
    $settings = app(Settings::class);
    $settings->set('modules', [...$settings->get('modules'), 'who_are_you' => false, 'hearts' => false, 'quiz' => false]);
    Capture::factory()->create(['table_no' => 7, 'hearts_count' => 4]);

    $this->getJson('/api/party/state')
        ->assertJsonPath('data.tallies', null)
        ->assertJsonPath('data.most_loved', [])
        ->assertJsonPath('data.leaderboard', null);
});

it('keeps the mosaic secret until it is revealed', function () {
    Mosaic::query()->create(['source_path' => 's.jpg', 'output_path' => 'mosaics/m.jpg', 'preview_path' => 'mosaics/p.jpg', 'status' => Mosaic::STATUS_READY]);

    $this->getJson('/api/party/state')->assertJsonPath('data.mosaic', null);

    app(Settings::class)->set('mosaic_revealed_at', now()->toIso8601String());
    $this->getJson('/api/party/state')->assertJsonPath('data.mosaic.download', '/storage/mosaics/m.jpg');
});
