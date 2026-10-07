<?php

use App\Models\Album;
use App\Models\Capture;
use App\Services\Settings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

it('creates an album with a readable code and returns its share url', function () {
    $clientUuid = (string) Str::uuid();

    $response = $this->postJson('/api/albums', ['client_uuid' => $clientUuid, 'station' => 'Main booth']);

    $response->assertCreated()
        ->assertJsonPath('data.client_uuid', $clientUuid);
    expect($response->json('data.code'))->toMatch('/^[A-Z]{4,5}-[2-9]{4}$/')
        ->and($response->json('data.url'))->toEndWith('/a/'.$response->json('data.code'));
    $this->assertDatabaseHas('albums', ['client_uuid' => $clientUuid, 'station' => 'Main booth']);
});

it('returns the same album when the booth retries with the same client uuid', function () {
    $clientUuid = (string) Str::uuid();
    $first = $this->postJson('/api/albums', ['client_uuid' => $clientUuid]);

    $second = $this->postJson('/api/albums', ['client_uuid' => $clientUuid]);

    $second->assertOk()->assertJsonPath('data.code', $first->json('data.code'));
    expect(Album::query()->count())->toBe(1);
});

it('gives every album a different code', function () {
    $codes = collect(range(1, 40))->map(
        fn () => $this->postJson('/api/albums', ['client_uuid' => (string) Str::uuid()])->json('data.code')
    );

    expect($codes->unique())->toHaveCount(40);
});

it('rejects an album without a valid client uuid', function () {
    $response = $this->postJson('/api/albums', ['client_uuid' => 'not-a-uuid']);

    $response->assertUnprocessable()->assertJsonValidationErrors(['client_uuid']);
    expect(Album::query()->count())->toBe(0);
});

it('shows an album with its visible captures in the order they were taken', function () {
    $album = Album::factory()->create(['code' => 'ROSE-4821']);
    $first = Capture::factory()->for($album)->create();
    Capture::factory()->for($album)->hidden()->create();
    $last = Capture::factory()->for($album)->boomerang()->create();

    $response = $this->getJson('/api/albums/rose-4821');

    $response->assertOk()
        ->assertJsonPath('data.code', 'ROSE-4821')
        ->assertJsonPath('data.captures_count', 2)
        ->assertJsonPath('data.captures.0.uuid', $first->uuid)
        ->assertJsonPath('data.captures.1.uuid', $last->uuid);
});

it('returns 404 for an unknown album code', function () {
    $this->getJson('/api/albums/NOPE-2222')->assertNotFound();
});

it('downloads the album photos as one zip', function () {
    Storage::fake('public');
    $album = Album::factory()->create(['code' => 'LACE-2345']);
    $capture = Capture::factory()->for($album)->create();
    Storage::disk('public')->put($capture->media_path, UploadedFile::fake()->image('c.jpg', 60, 90)->getContent());

    $response = $this->get('/api/albums/LACE-2345/zip');

    $response->assertOk()
        ->assertDownload('Edwin-Jochel-Wedding-LACE-2345.zip');
    $zip = new ZipArchive;
    $zip->open($response->baseResponse->getFile()->getPathname());
    expect($zip->getNameIndex(0))->toBe(sprintf('Edwin-Jochel-Wedding-%04d.jpg', $capture->id));
    $zip->close();
});

it('returns 403 for album zips when the couple turned them off', function () {
    app(Settings::class)->set('allow_zip_downloads', false);
    $album = Album::factory()->create(['code' => 'DOVE-2345']);
    Capture::factory()->for($album)->create();

    $this->getJson('/api/albums/DOVE-2345/zip')->assertForbidden();
});
