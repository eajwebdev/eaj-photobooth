<?php

use App\Models\Capture;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

it('shows a single capture with relative storage urls', function () {
    $capture = Capture::factory()->create();

    $response = $this->getJson('/api/captures/'.$capture->uuid);

    $response->assertOk()
        ->assertJsonPath('data.uuid', $capture->uuid)
        ->assertJsonPath('data.urls.media', '/storage/'.$capture->media_path)
        ->assertJsonPath('data.urls.page', '/p/'.$capture->uuid);
});

it('returns 404 for a hidden capture', function () {
    $capture = Capture::factory()->hidden()->create();

    $this->getJson('/api/captures/'.$capture->uuid)->assertNotFound();
});

it('downloads the full-quality file with a friendly name and counts it', function () {
    Storage::fake('public');
    $capture = Capture::factory()->create();
    Storage::disk('public')->put($capture->media_path, UploadedFile::fake()->image('c.jpg', 60, 90)->getContent());

    $response = $this->get('/api/captures/'.$capture->uuid.'/download');

    $response->assertDownload(sprintf('Edwin-Jochel-Wedding-%04d.jpg', $capture->id));
    expect($capture->refresh()->downloads)->toBe(1);
});

it('returns 404 when downloading a hidden capture', function () {
    Storage::fake('public');
    $capture = Capture::factory()->hidden()->create();
    Storage::disk('public')->put($capture->media_path, 'jpeg');

    $this->get('/api/captures/'.$capture->uuid.'/download')->assertNotFound();
    expect($capture->refresh()->downloads)->toBe(0);
});
