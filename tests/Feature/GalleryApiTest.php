<?php

use App\Models\Album;
use App\Models\Capture;
use App\Services\Settings;

it('lists visible captures newest first with the total count', function () {
    $older = Capture::factory()->create();
    $newer = Capture::factory()->boomerang()->create();
    Capture::factory()->hidden()->create();

    $response = $this->getJson('/api/gallery');

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.uuid', $newer->uuid)
        ->assertJsonPath('data.1.uuid', $older->uuid)
        ->assertJsonPath('total', 2);
});

it('finds captures by part of the guest name', function () {
    $match = Capture::factory()->create(['guest_name' => 'Lola Remedios']);
    Capture::factory()->create(['guest_name' => 'Kuya Jun']);

    $response = $this->getJson('/api/gallery?q=remed');

    $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.uuid', $match->uuid);
});

it('filters by type', function () {
    Capture::factory()->create();
    $boomerang = Capture::factory()->boomerang()->create();

    $response = $this->getJson('/api/gallery?type=boomerang');

    $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.uuid', $boomerang->uuid);
});

it('filters by album code', function () {
    $album = Album::factory()->create(['code' => 'RING-3456']);
    $inAlbum = Capture::factory()->for($album)->create();
    Capture::factory()->create();

    $response = $this->getJson('/api/gallery?album=ring-3456');

    $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.uuid', $inAlbum->uuid);
});

it('returns only captures newer than the given id for live updates', function () {
    $seen = Capture::factory()->create();
    $new = Capture::factory()->create();

    $response = $this->getJson('/api/gallery?after='.$seen->id);

    $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.uuid', $new->uuid);
});

it('pages through the gallery with a cursor', function () {
    Capture::factory()->count(5)->create();

    $first = $this->getJson('/api/gallery?per_page=3');
    $second = $this->getJson('/api/gallery?per_page=3&cursor='.$first->json('meta.next_cursor'));

    $first->assertJsonCount(3, 'data');
    $second->assertJsonCount(2, 'data');
    expect($second->json('meta.next_cursor'))->toBeNull();
});

it('returns 401 when the gallery needs the wedding code and none is sent', function () {
    app(Settings::class)->setMany(['gallery_access' => 'code', 'gallery_code' => 'Mahal2026']);

    $this->getJson('/api/gallery')->assertUnauthorized()->assertJsonPath('requires_code', true);
});

it('opens the gallery with the right wedding code', function () {
    app(Settings::class)->setMany(['gallery_access' => 'code', 'gallery_code' => 'Mahal2026']);
    Capture::factory()->create();

    $response = $this->getJson('/api/gallery', ['X-Gallery-Code' => 'mahal2026']);

    $response->assertOk()->assertJsonCount(1, 'data');
});
