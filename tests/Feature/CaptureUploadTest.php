<?php

use App\Models\Album;
use App\Models\Capture;
use App\Models\Layout;
use Database\Seeders\LayoutSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

it('saves a collage with its shots into the guest album and the gallery', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);
    $albumUuid = (string) Str::uuid();
    $album = $this->postJson('/api/albums', ['client_uuid' => $albumUuid])->json('data');

    $response = $this->post('/api/captures', collagePayload(['album_client_uuid' => $albumUuid]), ['Accept' => 'application/json']);

    $response->assertCreated()
        ->assertJsonPath('data.type', 'collage')
        ->assertJsonPath('data.layout', 'photo-strip-3')
        ->assertJsonPath('data.album', $album['code'])
        ->assertJsonPath('data.width', 600)
        ->assertJsonPath('data.height', 1800);

    $capture = Capture::query()->with('shots')->sole();
    expect($capture->shots)->toHaveCount(3)
        ->and($capture->guest_name)->toBe('Tita Baby')
        ->and($capture->thumb_path)->not->toBeNull()
        ->and($capture->preview_path)->not->toBeNull()
        ->and($capture->dominant_color)->toMatch('/^#[0-9a-f]{6}$/')
        ->and(Album::query()->where('client_uuid', $albumUuid)->value('captures_count'))->toBe(1);
    Storage::disk('public')->assertExists([
        $capture->media_path,
        $capture->thumb_path,
        $capture->preview_path,
        ...$capture->shots->pluck('image_path'),
    ]);

    $this->getJson('/api/gallery')->assertJsonPath('data.0.uuid', $capture->uuid);
    $this->getJson('/api/albums/'.$album['code'])->assertJsonPath('data.captures.0.uuid', $capture->uuid);
});

it('opens the album on the fly when the capture arrives before the album request', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);
    $albumUuid = (string) Str::uuid();

    $this->post('/api/captures', collagePayload(['album_client_uuid' => $albumUuid]), ['Accept' => 'application/json'])
        ->assertCreated();

    expect(Album::query()->where('client_uuid', $albumUuid)->value('captures_count'))->toBe(1);
});

it('saves a boomerang with its poster', function () {
    Storage::fake('public');

    $response = $this->post('/api/captures', boomerangPayload(), ['Accept' => 'application/json']);

    $response->assertCreated()
        ->assertJsonPath('data.type', 'boomerang')
        ->assertJsonPath('data.mime', 'video/mp4')
        ->assertJsonPath('data.duration_ms', 4500)
        ->assertJsonPath('data.camera', 'back');
    $capture = Capture::query()->sole();
    expect($capture->media_path)->toEndWith('.mp4')
        ->and($capture->poster_path)->toEndWith('-poster.jpg')
        ->and($capture->thumb_path)->not->toBeNull();
    Storage::disk('public')->assertExists([$capture->media_path, $capture->poster_path]);
});

it('stores a retried upload exactly once and answers 200 the second time', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);
    $clientUuid = (string) Str::uuid();
    $first = $this->post('/api/captures', collagePayload(['client_uuid' => $clientUuid]), ['Accept' => 'application/json']);

    $second = $this->post('/api/captures', collagePayload(['client_uuid' => $clientUuid]), ['Accept' => 'application/json']);

    $first->assertCreated();
    $second->assertOk()->assertJsonPath('data.uuid', $first->json('data.uuid'));
    expect(Capture::query()->count())->toBe(1);
});

it('answers a retry with the stored capture even after its frame was switched off', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);
    $clientUuid = (string) Str::uuid();
    $this->post('/api/captures', collagePayload(['client_uuid' => $clientUuid]), ['Accept' => 'application/json']);
    Layout::query()->where('slug', 'photo-strip-3')->update(['is_active' => false]);

    $retry = $this->post('/api/captures', collagePayload(['client_uuid' => $clientUuid]), ['Accept' => 'application/json']);

    $retry->assertOk();
    expect(Capture::query()->count())->toBe(1);
});

it('rejects a collage made with a frame that is switched off', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);
    Layout::query()->where('slug', 'photo-strip-3')->update(['is_active' => false]);

    $response = $this->post('/api/captures', collagePayload(), ['Accept' => 'application/json']);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['layout' => 'That frame is not available right now. Please choose another one.']);
    expect(Capture::query()->count())->toBe(0);
});

it('rejects a boomerang without its poster', function () {
    Storage::fake('public');

    $response = $this->post('/api/captures', boomerangPayload(['poster' => null]), ['Accept' => 'application/json']);

    $response->assertUnprocessable()->assertJsonValidationErrors(['poster']);
    expect(Capture::query()->count())->toBe(0);
});

it('rejects a collage that is not a jpeg', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);

    $response = $this->post('/api/captures', collagePayload([
        'media' => UploadedFile::fake()->create('collage.png', 100, 'image/png'),
    ]), ['Accept' => 'application/json']);

    $response->assertUnprocessable()->assertJsonValidationErrors(['media']);
    expect(Capture::query()->count())->toBe(0);
});

it('requires a client uuid, a type and the file', function () {
    $response = $this->postJson('/api/captures', []);

    $response->assertUnprocessable()->assertJsonValidationErrors(['client_uuid', 'type', 'media']);
});

it('accepts a GIF boomerang from browsers that cannot record video', function () {
    Storage::fake('public');

    $response = $this->post('/api/captures', boomerangPayload([
        'media' => UploadedFile::fake()->create('boomerang.gif', 400, 'image/gif'),
        'width' => 480,
        'height' => 600,
    ]), ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonPath('data.mime', 'image/gif');
    expect(Capture::query()->sole()->media_path)->toEndWith('.gif');
});
