<?php

use App\Jobs\BackupCaptureToGoogleDrive;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use Database\Seeders\LayoutSeeder;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
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
    $drive = Mockery::mock(GoogleDriveBackup::class)->makePartial();
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

it('stores a plain-language reason when Google rejects the login', function () {
    Sleep::fake();
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['error' => 'unauthorized_client', 'error_description' => 'Unauthorized'], 401),
    ]);
    $capture = Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_PENDING]);
    $job = new BackupCaptureToGoogleDrive($capture);

    expect(fn () => $job->handle(app(GoogleDriveBackup::class)))->toThrow(RequestException::class);

    expect($capture->refresh()->drive_backup_error)
        ->toBe('Google rejected the login: GOOGLE_DRIVE_REFRESH_TOKEN was created with a different OAuth client than GOOGLE_DRIVE_CLIENT_ID. Create a new refresh token with this client, or use the client it was created with.');
});

it('confirms the Drive connection when the folder accepts new files', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token'], 200),
        'https://www.googleapis.com/drive/v3/files/wedding-folder*' => Http::response(driveFolder(), 200),
    ]);

    $response = $this->postJson('/api/admin/drive/check', [], adminHeaders());

    $response->assertOk()
        ->assertJsonPath('data.ok', true)
        ->assertJsonPath('data.message', null);
});

it('explains why the Drive connection test failed', function (array $tokenResponse, int $tokenStatus, array $folderResponse, int $folderStatus, string $message) {
    Sleep::fake();
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response($tokenResponse, $tokenStatus),
        'https://www.googleapis.com/drive/v3/files/wedding-folder*' => Http::response($folderResponse, $folderStatus),
    ]);

    $response = $this->postJson('/api/admin/drive/check', [], adminHeaders());

    $response->assertOk()
        ->assertJsonPath('data.ok', false)
        ->assertJsonPath('data.message', $message);
})->with([
    'refresh token from another client' => [
        ['error' => 'unauthorized_client'], 401, [], 200,
        'Google rejected the login: GOOGLE_DRIVE_REFRESH_TOKEN was created with a different OAuth client than GOOGLE_DRIVE_CLIENT_ID. Create a new refresh token with this client, or use the client it was created with.',
    ],
    'expired or revoked refresh token' => [
        ['error' => 'invalid_grant'], 400, [], 200,
        'Google refused GOOGLE_DRIVE_REFRESH_TOKEN: it expired or its access was removed. Create a new refresh token in the OAuth Playground.',
    ],
    'folder not found' => [
        ['access_token' => 'access-token'], 200, ['error' => ['code' => 404, 'message' => 'File not found: wedding-folder.']], 404,
        'The backup folder was not found. Check GOOGLE_DRIVE_FOLDER_ID, and that the folder belongs to the Google account that created the refresh token.',
    ],
    'folder is read-only' => [
        ['access_token' => 'access-token'], 200, driveFolder(['capabilities' => ['canAddChildren' => false]]), 200,
        'This Google account cannot add files to the backup folder. Use a folder it owns, or share the folder with it as Editor.',
    ],
    'folder is in the trash' => [
        ['access_token' => 'access-token'], 200, driveFolder(['trashed' => true]), 200,
        'The backup folder is in the Google Drive trash. Restore it, or create a new folder and update GOOGLE_DRIVE_FOLDER_ID.',
    ],
]);

it('names the missing Drive settings without calling Google', function () {
    Http::preventStrayRequests();
    Http::fake();
    config()->set('services.google_drive.refresh_token', '');
    config()->set('services.google_drive.folder_id', null);

    $response = $this->postJson('/api/admin/drive/check', [], adminHeaders());

    $response->assertJsonPath('data.ok', false)
        ->assertJsonPath('data.message', 'Missing in .env: GOOGLE_DRIVE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID.');
    Http::assertNothingSent();
});

it('queues failed backups again and leaves the others alone', function () {
    $failed = Capture::factory()->create([
        'drive_backup_status' => Capture::DRIVE_BACKUP_FAILED,
        'drive_backup_error' => 'Google Drive is full.',
    ]);
    Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_COMPLETE]);
    Queue::fake([BackupCaptureToGoogleDrive::class]);

    $response = $this->postJson('/api/admin/drive/retry', [], adminHeaders());

    $response->assertOk()->assertJsonPath('data.queued', 1);
    expect($failed->refresh()->drive_backup_status)->toBe(Capture::DRIVE_BACKUP_PENDING)
        ->and($failed->drive_backup_error)->toBeNull();
    Queue::assertPushed(BackupCaptureToGoogleDrive::class, fn (BackupCaptureToGoogleDrive $job): bool => $job->capture->is($failed));
});

it('returns 422 when retrying backups before Drive is configured', function () {
    config()->set('services.google_drive.client_secret', null);
    Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_FAILED]);
    Queue::fake([BackupCaptureToGoogleDrive::class]);

    $response = $this->postJson('/api/admin/drive/retry', [], adminHeaders());

    $response->assertUnprocessable()
        ->assertJsonPath('message', 'Google Drive backup is switched off or its settings in .env are incomplete.');
    Queue::assertNotPushed(BackupCaptureToGoogleDrive::class);
});

it('shows recent backup errors and backups no worker has picked up', function () {
    $this->freezeTime();
    Capture::factory()->create([
        'guest_name' => 'Lola Nena',
        'drive_backup_status' => Capture::DRIVE_BACKUP_FAILED,
        'drive_backup_error' => 'Google Drive is full.',
    ]);
    Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_PENDING, 'updated_at' => now()->subMinutes(11)]);
    Capture::factory()->create(['drive_backup_status' => Capture::DRIVE_BACKUP_PENDING, 'updated_at' => now()->subMinutes(9)]);

    $response = $this->getJson('/api/admin/stats', adminHeaders());

    $response->assertOk()
        ->assertJsonPath('data.drive_backup.configured', true)
        ->assertJsonPath('data.drive_backup.stuck', 1)
        ->assertJsonCount(1, 'data.drive_backup.errors')
        ->assertJsonPath('data.drive_backup.errors.0.guest_name', 'Lola Nena')
        ->assertJsonPath('data.drive_backup.errors.0.status', Capture::DRIVE_BACKUP_FAILED)
        ->assertJsonPath('data.drive_backup.errors.0.error', 'Google Drive is full.');
});

it('reports a working Drive connection from the command line', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'access-token'], 200),
        'https://www.googleapis.com/drive/v3/files/wedding-folder*' => Http::response(driveFolder(), 200),
    ]);

    $this->artisan('photobooth:drive-check')
        ->expectsOutput('Google Drive is connected and the backup folder accepts new files.')
        ->assertSuccessful();
});

it('fails the command line check with the reason', function () {
    config()->set('services.google_drive.backup_enabled', false);

    $this->artisan('photobooth:drive-check')
        ->expectsOutput('Google Drive backup is switched off. Set GOOGLE_DRIVE_BACKUP_ENABLED=true in .env.')
        ->assertFailed();
});

/**
 * Drive's metadata for a usable backup folder, with optional overrides.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function driveFolder(array $overrides = []): array
{
    return [
        'id' => 'wedding-folder',
        'mimeType' => 'application/vnd.google-apps.folder',
        'trashed' => false,
        'capabilities' => ['canAddChildren' => true],
        ...$overrides,
    ];
}
