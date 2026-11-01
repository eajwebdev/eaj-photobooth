<?php

use App\Jobs\BackupCaptureToGoogleDrive;
use App\Models\Album;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Sleep;

beforeEach(function () {
    config()->set('services.google_drive', [
        'backup_enabled' => true,
        'client_id' => 'client-id',
        'client_secret' => 'client-secret',
        'refresh_token' => 'refresh-token',
        'folder_id' => 'wedding-folder',
    ]);
    config()->set('photobooth.storage', 'drive');

    Cache::flush();
});

it('moves a capture into Drive, shares what guests see and deletes the server copies', function () {
    Storage::fake('public');
    $capture = capturedOnServer();
    fakeDriveUploads();

    (new BackupCaptureToGoogleDrive($capture))->handle(app(GoogleDriveBackup::class));

    $capture->refresh();
    expect($capture->drive_files)->toBe([
        $capture->media_path => 'file-1',
        $capture->signature_path => 'file-2',
        'shots/20261212/one.jpg' => 'file-3',
    ])
        ->and($capture->stored_in_drive_at)->not->toBeNull()
        ->and($capture->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_COMPLETE);
    foreach ([$capture->media_path, $capture->thumb_path, $capture->preview_path, $capture->signature_path, 'shots/20261212/one.jpg'] as $path) {
        Storage::disk('public')->assertMissing($path);
    }
    // Token, folder lookup and create, a duplicate check and upload per file, two shares.
    Http::assertSentCount(11);
    Http::assertSent(fn (Request $request): bool => str_ends_with(parse_url($request->url(), PHP_URL_PATH), '/files/file-1/permissions')
        && $request['type'] === 'anyone' && $request['role'] === 'reader');
    Http::assertSent(fn (Request $request): bool => str_ends_with(parse_url($request->url(), PHP_URL_PATH), '/files/file-2/permissions'));
    Http::assertNotSent(fn (Request $request): bool => str_ends_with(parse_url($request->url(), PHP_URL_PATH), '/files/file-3/permissions'));
});

it('keeps the server copies and private Drive files when storage is local', function () {
    config()->set('photobooth.storage', 'local');
    Storage::fake('public');
    $capture = capturedOnServer();
    fakeDriveUploads();

    (new BackupCaptureToGoogleDrive($capture))->handle(app(GoogleDriveBackup::class));

    $capture->refresh();
    expect($capture->drive_files)->toHaveCount(3)
        ->and($capture->stored_in_drive_at)->toBeNull();
    Storage::disk('public')->assertExists([$capture->media_path, $capture->thumb_path, 'shots/20261212/one.jpg']);
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), '/permissions'));
});

it('waits for the gallery thumbnail before moving a capture to Drive', function () {
    Http::preventStrayRequests();
    Http::fake();
    $capture = Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_PENDING]);
    $job = (new BackupCaptureToGoogleDrive($capture))->withFakeQueueInteractions();

    $job->handle(app(GoogleDriveBackup::class));

    $job->assertReleased(30);
    Http::assertNothingSent();
});

it('serves a photo stored in Drive from Google’s image servers at gallery sizes', function () {
    $capture = Capture::factory()->storedInDrive()->create();

    $response = $this->getJson('/api/captures/'.$capture->uuid);

    $response->assertOk()
        ->assertJsonPath('data.urls.thumb', 'https://lh3.googleusercontent.com/d/drive-media=w520')
        ->assertJsonPath('data.urls.preview', 'https://lh3.googleusercontent.com/d/drive-media=w1080')
        ->assertJsonPath('data.urls.media', 'https://lh3.googleusercontent.com/d/drive-media=s0')
        ->assertJsonPath('data.urls.download', '/api/captures/'.$capture->uuid.'/download');
});

it('serves a boomerang video from the Drive download link and its poster as an image', function () {
    $capture = Capture::factory()->boomerang()->storedInDrive()->create();

    $response = $this->getJson('/api/captures/'.$capture->uuid);

    $response->assertJsonPath('data.urls.media', 'https://drive.google.com/uc?export=download&id=drive-media')
        ->assertJsonPath('data.urls.poster', 'https://lh3.googleusercontent.com/d/drive-poster=s0')
        ->assertJsonPath('data.urls.thumb', 'https://lh3.googleusercontent.com/d/drive-poster=w520');
});

it('streams the original from Drive with a friendly name and counts the download', function () {
    Storage::fake('public');
    $capture = Capture::factory()->storedInDrive()->create();
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
        'https://www.googleapis.com/drive/v3/files/drive-media*' => Http::response('original-jpeg-bytes'),
    ]);

    $response = $this->get('/api/captures/'.$capture->uuid.'/download');

    $response->assertDownload(sprintf('Edwin-Jochel-Wedding-%04d.jpg', $capture->id));
    expect($response->streamedContent())->toBe('original-jpeg-bytes')
        ->and($capture->refresh()->downloads)->toBe(1);
});

it('returns 503 when the original cannot be fetched from Drive', function () {
    Sleep::fake();
    Storage::fake('public');
    $capture = Capture::factory()->storedInDrive()->create();
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
        'https://www.googleapis.com/drive/v3/files/drive-media*' => Http::response(['error' => ['code' => 500]], 500),
    ]);

    $response = $this->get('/api/captures/'.$capture->uuid.'/download');

    $response->assertServiceUnavailable();
    expect($capture->refresh()->downloads)->toBe(0);
});

it('packs album photos stored in Drive into the album zip', function () {
    Storage::fake('public');
    $album = Album::factory()->create(['code' => 'ROSE-2345']);
    $capture = Capture::factory()->for($album)->storedInDrive()->create();
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
        'https://www.googleapis.com/drive/v3/files/drive-media*' => Http::response('original-jpeg-bytes'),
    ]);

    $response = $this->get('/api/albums/ROSE-2345/zip');

    $response->assertOk();
    $zip = new ZipArchive;
    $zip->open($response->baseResponse->getFile()->getPathname());
    expect($zip->getFromName(sprintf('Edwin-Jochel-Wedding-%04d.jpg', $capture->id)))->toBe('original-jpeg-bytes');
    $zip->close();
    expect(Storage::disk('local')->files('tmp/drive'))->toBe([]);
});

it('moves a deleted capture’s Drive folder to the Drive trash', function () {
    $capture = Capture::factory()->storedInDrive()->create();
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
        'https://www.googleapis.com/drive/v3/files/capture-folder*' => Http::response(['id' => 'capture-folder']),
    ]);

    $this->deleteJson('/api/admin/captures/'.$capture->uuid, [], adminHeaders())->assertNoContent();

    $this->assertModelMissing($capture);
    Http::assertSent(fn (Request $request): bool => $request->method() === 'PATCH'
        && str_contains($request->url(), '/files/capture-folder')
        && $request['trashed'] === true);
});

it('queues every capture still on the server, including finished backups', function () {
    $backedUpOnly = Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_COMPLETE]);
    Capture::factory()->storedInDrive()->create();
    Queue::fake([BackupCaptureToGoogleDrive::class]);

    $this->artisan('photobooth:drive-backup')
        ->expectsOutput('Queued 1 capture(s) on the backups queue.')
        ->assertSuccessful();

    Queue::assertPushed(BackupCaptureToGoogleDrive::class, fn (BackupCaptureToGoogleDrive $job): bool => $job->capture->is($backedUpOnly));
});

/**
 * A collage on the server with its thumbnail, preview, signature and one raw shot.
 */
function capturedOnServer(): Capture
{
    $capture = Capture::factory()->create([
        'thumb_path' => 'thumbs/20261212/one.jpg',
        'preview_path' => 'previews/20261212/one.jpg',
        'signature_path' => 'signatures/one.png',
        'drive_backup_status' => Capture::DRIVE_BACKUP_PENDING,
    ]);
    $capture->shots()->create(['position' => 1, 'image_path' => 'shots/20261212/one.jpg']);

    foreach ([$capture->media_path, $capture->thumb_path, $capture->preview_path, $capture->signature_path, 'shots/20261212/one.jpg'] as $path) {
        Storage::disk('public')->put($path, UploadedFile::fake()->image('p.jpg', 20, 30)->getContent());
    }

    return $capture;
}

/**
 * Drive with an empty capture folder: uploads get IDs file-1, file-2, … in order.
 */
function fakeDriveUploads(): void
{
    $uploads = 0;
    Http::preventStrayRequests();
    Http::fake(function (Request $request) use (&$uploads) {
        $path = (string) parse_url($request->url(), PHP_URL_PATH);

        return match (true) {
            $request->url() === 'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token']),
            str_starts_with($path, '/upload/drive/v3/files') => Http::response(['id' => 'file-'.++$uploads]),
            str_ends_with($path, '/permissions') => Http::response(['id' => 'anyoneWithLink']),
            $request->method() === 'GET' => Http::response(['files' => []]),
            default => Http::response(['id' => 'capture-folder']),
        };
    });
}
