<?php

use App\Models\Album;
use App\Models\Capture;
use Inertia\Testing\AssertableInertia as Assert;

it('renders the share page for a photo with its album code', function () {
    $album = Album::factory()->create(['code' => 'ROSE-4821']);
    $capture = Capture::factory()->for($album)->create();

    $response = $this->get('/p/'.$capture->uuid);

    $response->assertInertia(fn (Assert $page) => $page
        ->component('capture')
        ->where('capture.uuid', $capture->uuid)
        ->where('capture.album', 'ROSE-4821')
        ->where('capture.urls.download', '/api/captures/'.$capture->uuid.'/download'));
});

it('returns 404 for the share page of a hidden photo', function () {
    $capture = Capture::factory()->hidden()->create();

    $this->get('/p/'.$capture->uuid)->assertNotFound();
});

it('renders a guest album from its QR code, visible photos only', function () {
    $album = Album::factory()->create(['code' => 'LACE-2345']);
    $shown = Capture::factory()->for($album)->create();
    Capture::factory()->for($album)->hidden()->create();

    $response = $this->get('/a/lace-2345');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('album')
        ->where('code', 'LACE-2345')
        ->where('album.code', 'LACE-2345')
        ->where('album.captures_count', 1)
        ->has('album.captures', 1)
        ->where('album.captures.0.uuid', $shown->uuid));
});

it('shows a friendly page for an album that has not synced yet', function () {
    $response = $this->get('/a/DOVE-9999');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('album')
        ->where('code', 'DOVE-9999')
        ->where('album', null));
});

it('renders the gallery page', function () {
    $this->get('/gallery')->assertInertia(fn (Assert $page) => $page->component('gallery'));
});
