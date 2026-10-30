<?php

use App\Jobs\BackupCaptureToGoogleDrive;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use Database\Seeders\LayoutSeeder;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config()->set('services.google_drive', [
        'backup_enabled' => true,
        'client_id' => 'client-id',
        'client_secret' => 'client-secret',
        'refresh_token' => 'refresh-token',
        'folder_id' => 'wedding-folder',
    ]);

    Cache::flush();
});

it('queues a Drive backup without delaying a capture upload', function () {
    Queue::fake([BackupCaptureToGoogleDrive::class]);
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);

    $this->post('/api/captures', collagePayload(), ['Accept' => 'application/json'])
        ->assertCreated();

    $capture = Capture::query()->sole();

    expect($capture->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_PENDING);
    Queue::assertPushed(BackupCaptureToGoogleDrive::class, fn (BackupCaptureToGoogleDrive $job): bool => $job->capture->is($capture) && $job->queue === 'backups'
    );
});

it('backs up the original capture, poster, signature and raw shots', function () {
    Storage::fake('public');
    $capture = Capture::factory()->boomerang()->create([
        'signature_path' => 'signatures/example.png',
        'drive_backup_status' => Capture::DRIVE_BACKUP_PENDING,
    ]);
    $capture->shots()->create(['position' => 1, 'image_path' => 'shots/example/1.jpg']);

    foreach ([$capture->media_path, $capture->poster_path, $capture->signature_path, 'shots/example/1.jpg'] as $path) {
        Storage::disk('public')->put($path, 'file-bytes');
    }

    Http::fake(function (Request $request) {
        if ($request->url() === 'https://oauth2.googleapis.com/token') {
            return Http::response(['access_token' => 'access-token'], 200);
        }

        if ($request->method() === 'GET') {
            return Http::response(['files' => []], 200);
        }

        if (str_contains($request->url(), '/upload/drive/v3/files')) {
            return Http::response(['id' => 'uploaded-file'], 200);
        }

        return Http::response(['id' => 'capture-folder'], 200);
    });

    (new BackupCaptureToGoogleDrive($capture))->handle(app(GoogleDriveBackup::class));

    $capture->refresh();
    expect($capture->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_COMPLETE)
        ->and($capture->drive_folder_id)->toBe('capture-folder')
        ->and($capture->drive_backed_up_at)->not->toBeNull();

    Http::assertSentCount(11);
    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/upload/drive/v3/files')
        && str_contains($request->body(), 'photobooth_source_hash')
    );
});

it('skips files that already exist in the Drive capture folder', function () {
    Storage::fake('public');
    $capture = Capture::factory()->create([
        'drive_backup_status' => Capture::DRIVE_BACKUP_PENDING,
        'drive_folder_id' => 'existing-folder',
    ]);
    Storage::disk('public')->put($capture->media_path, 'file-bytes');

    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token'], 200),
        'https://www.googleapis.com/drive/v3/files*' => Http::response(['files' => [['id' => 'existing-file']]], 200),
        '*' => Http::response([], 500),
    ]);

    (new BackupCaptureToGoogleDrive($capture))->handle(app(GoogleDriveBackup::class));

    expect($capture->refresh()->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_COMPLETE);
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), '/upload/drive/v3/files'));
});

it('records a retryable error and a final failed status', function () {
    $capture = Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_PENDING]);
    $drive = Mockery::mock(GoogleDriveBackup::class);
    $drive->shouldReceive('backup')->once()->andThrow(new RuntimeException('Drive is unavailable.'));
    $job = new BackupCaptureToGoogleDrive($capture);

    expect(fn () => $job->handle($drive))->toThrow(RuntimeException::class, 'Drive is unavailable.');
    expect($capture->refresh()->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_PENDING)
        ->and($capture->drive_backup_error)->toBe('Drive is unavailable.');

    $job->failed(new RuntimeException('Drive is unavailable.'));

    expect($capture->refresh()->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_FAILED);
});

it('refuses to queue old captures until Drive is fully configured', function () {
    config()->set('services.google_drive.refresh_token', null);

    $this->artisan('photobooth:drive-backup')
        ->expectsOutput('Google Drive backup is disabled or its OAuth credentials and folder ID are incomplete.')
        ->assertFailed();
});
