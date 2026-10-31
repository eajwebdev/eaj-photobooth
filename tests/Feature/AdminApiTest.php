<?php

use App\Jobs\BuildArchiveExport;
use App\Models\Capture;
use App\Models\Export;
use App\Models\Layout;
use App\Services\Settings;
use Database\Seeders\LayoutSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

it('returns 401 for admin routes without the PIN', function (string $method, string $uri) {
    adminHeaders();

    $this->json($method, $uri)->assertUnauthorized();
})->with([
    'stats' => ['GET', '/api/admin/stats'],
    'captures' => ['GET', '/api/admin/captures'],
    'settings' => ['GET', '/api/admin/settings'],
    'settings update' => ['PUT', '/api/admin/settings'],
    'export' => ['POST', '/api/admin/exports'],
    'drive check' => ['POST', '/api/admin/drive/check'],
    'drive retry' => ['POST', '/api/admin/drive/retry'],
]);

it('returns 401 for a wrong PIN', function () {
    adminHeaders('2468');

    $this->getJson('/api/admin/stats', ['X-Admin-Pin' => '1111'])->assertUnauthorized();
});

it('returns 429 after five wrong PINs in a row', function () {
    adminHeaders('2468');
    foreach (range(1, 5) as $attempt) {
        $this->getJson('/api/admin/stats', ['X-Admin-Pin' => '0000']);
    }

    $response = $this->getJson('/api/admin/stats', ['X-Admin-Pin' => '2468']);

    $response->assertTooManyRequests();
});

it('confirms a correct PIN', function () {
    $this->postJson('/api/admin/session', [], adminHeaders())->assertNoContent();
});

it('reports live stats', function () {
    Capture::factory()->count(2)->create(['station' => 'Main booth']);
    Capture::factory()->boomerang()->create(['station' => 'Roaming phone']);

    $response = $this->getJson('/api/admin/stats', adminHeaders());

    $response->assertOk()
        ->assertJsonPath('data.captures.total', 3)
        ->assertJsonPath('data.captures.collage', 2)
        ->assertJsonPath('data.captures.boomerang', 1)
        ->assertJsonPath('data.stations.0.station', 'Main booth');
});

it('hides a capture so it leaves the gallery at once', function () {
    $capture = Capture::factory()->create();

    $this->patchJson('/api/admin/captures/'.$capture->uuid, ['is_hidden' => true], adminHeaders())
        ->assertOk()
        ->assertJsonPath('data.uuid', $capture->uuid);

    expect($capture->refresh()->is_hidden)->toBeTrue();
    $this->getJson('/api/gallery')->assertJsonCount(0, 'data');
    $this->getJson('/api/captures/'.$capture->uuid)->assertNotFound();
});

it('lists hidden captures for staff with filters', function () {
    $hidden = Capture::factory()->hidden()->create();
    Capture::factory()->create();

    $response = $this->getJson('/api/admin/captures?hidden=1', adminHeaders());

    $response->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.uuid', $hidden->uuid);
});

it('deletes a capture together with its files', function () {
    Storage::fake('public');
    $capture = Capture::factory()->create(['thumb_path' => 'thumbs/x.jpg']);
    Storage::disk('public')->put($capture->media_path, 'jpeg');
    Storage::disk('public')->put('thumbs/x.jpg', 'jpeg');

    $this->deleteJson('/api/admin/captures/'.$capture->uuid, [], adminHeaders())->assertNoContent();

    $this->assertModelMissing($capture);
    Storage::disk('public')->assertMissing([$capture->media_path, 'thumbs/x.jpg']);
});

it('switches a frame off', function () {
    $this->seed(LayoutSeeder::class);

    $this->patchJson('/api/admin/layouts/grid-4', ['is_active' => false], adminHeaders())
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    expect(Layout::query()->where('slug', 'grid-4')->value('is_active'))->toBeFalse();
});

it('updates settings and stores a new PIN hashed', function () {
    $headers = adminHeaders('2468');

    $response = $this->putJson('/api/admin/settings', [
        'hashtag' => '#EdwinAndJochel2026',
        'countdown_seconds' => 5,
        'admin_pin' => '13579',
    ], $headers);

    $response->assertOk()
        ->assertJsonPath('data.hashtag', '#EdwinAndJochel2026')
        ->assertJsonPath('data.countdown_seconds', 5)
        ->assertJsonMissingPath('data.admin_pin_hash');
    $settings = app(Settings::class);
    $settings->flush();
    expect($settings->pinMatches('admin', '13579'))->toBeTrue()
        ->and($settings->pinMatches('admin', '2468'))->toBeFalse();
});

it('rejects a PIN that is not 4 to 8 digits', function () {
    $response = $this->putJson('/api/admin/settings', ['admin_pin' => '12'], adminHeaders());

    $response->assertUnprocessable()->assertJsonValidationErrors(['admin_pin' => 'The admin PIN must be 4 to 8 digits.']);
});

it('queues an archive export', function () {
    Queue::fake([BuildArchiveExport::class]);

    $response = $this->postJson('/api/admin/exports', [], adminHeaders());

    $response->assertAccepted()->assertJsonPath('data.status', 'pending');
    Queue::assertPushed(BuildArchiveExport::class, fn (BuildArchiveExport $job) => $job->export->uuid === $response->json('data.uuid'));
});

it('builds the archive with folders and a guestbook csv, downloadable through a signed link', function () {
    Storage::fake('public');
    Storage::fake('local');
    $capture = Capture::factory()->create(['message' => 'Congrats!']);
    Storage::disk('public')->put($capture->media_path, UploadedFile::fake()->image('c.jpg', 60, 90)->getContent());

    $created = $this->postJson('/api/admin/exports', [], adminHeaders());
    $status = $this->getJson('/api/admin/exports/'.$created->json('data.uuid'), adminHeaders());

    $status->assertJsonPath('data.status', Export::STATUS_READY);
    $zip = new ZipArchive;
    $zip->open(Storage::disk('local')->path(Export::query()->sole()->path));
    expect($zip->locateName(sprintf('collages/Edwin-Jochel-Wedding-%04d.jpg', $capture->id)))->not->toBeFalse()
        ->and($zip->getFromName('guestbook.csv'))->toContain('Congrats!');
    $zip->close();
    $this->get($status->json('data.download_url'))->assertDownload();
});

it('shows each booth device’s waiting uploads from its heartbeat', function () {
    $this->postJson('/api/stations/heartbeat', ['station' => 'Roaming phone', 'waiting' => 3, 'failed' => 1])->assertNoContent();

    $response = $this->getJson('/api/admin/stats', adminHeaders());

    $response->assertJsonPath('data.stations.0.station', 'Roaming phone')
        ->assertJsonPath('data.stations.0.waiting', 3)
        ->assertJsonPath('data.stations.0.failed', 1);
});

it('rejects a heartbeat without a station name', function () {
    $this->postJson('/api/stations/heartbeat', ['waiting' => 1, 'failed' => 0])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['station']);
});
