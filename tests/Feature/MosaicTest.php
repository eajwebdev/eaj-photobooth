<?php

use App\Jobs\BuildMosaic;
use App\Models\Capture;
use App\Models\Mosaic;
use App\Services\Settings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function smallMosaicGrid(): void
{
    config(['photobooth.mosaic' => ['cols' => 6, 'rows' => 9, 'tile' => 20, 'overlay' => 25, 'max_tiles' => 50]]);
}

function collagesWithThumbs(int $count): void
{
    foreach (range(1, $count) as $index) {
        $path = "thumbs/t{$index}.jpg";
        Storage::disk('public')->put($path, UploadedFile::fake()->image("t{$index}.jpg", 52, 78)->getContent());
        Capture::factory()->create(['thumb_path' => $path]);
    }
}

it('queues the mosaic when staff upload the couple photo', function () {
    Queue::fake([BuildMosaic::class]);
    Storage::fake('local');

    $response = $this->post('/api/admin/mosaic', ['photo' => UploadedFile::fake()->image('couple.jpg', 300, 450)], adminHeaders() + ['Accept' => 'application/json']);

    $response->assertAccepted()->assertJsonPath('data.status', 'pending');
    Queue::assertPushed(BuildMosaic::class, fn (BuildMosaic $job) => $job->mosaic->is(Mosaic::query()->sole()));
});

it('builds the mosaic from guest collages at the configured size', function () {
    Storage::fake('public');
    Storage::fake('local');
    smallMosaicGrid();
    collagesWithThumbs(5);
    Storage::disk('local')->put('mosaics/source.jpg', UploadedFile::fake()->image('couple.jpg', 300, 450)->getContent());
    $mosaic = Mosaic::query()->create(['source_path' => 'mosaics/source.jpg', 'status' => Mosaic::STATUS_PENDING]);

    (new BuildMosaic($mosaic))->handle();

    $mosaic->refresh();
    expect($mosaic->status)->toBe(Mosaic::STATUS_READY)
        ->and($mosaic->tiles)->toBe(5)
        ->and($mosaic->built_at)->not->toBeNull();
    [$width, $height] = getimagesizefromstring(Storage::disk('public')->get($mosaic->output_path));
    expect([$width, $height])->toBe([120, 180]);
    Storage::disk('public')->assertExists($mosaic->preview_path);
});

it('fails with a clear message when there are no collages yet', function () {
    Storage::fake('public');
    Storage::fake('local');
    smallMosaicGrid();
    Storage::disk('local')->put('mosaics/source.jpg', UploadedFile::fake()->image('couple.jpg', 300, 450)->getContent());
    $mosaic = Mosaic::query()->create(['source_path' => 'mosaics/source.jpg', 'status' => Mosaic::STATUS_PENDING]);
    $job = new BuildMosaic($mosaic);

    expect(fn () => $job->handle())->toThrow(RuntimeException::class, 'There are no guest collages yet to build the mosaic from.');

    $job->failed(new RuntimeException('There are no guest collages yet to build the mosaic from.'));
    expect($mosaic->refresh()->status)->toBe(Mosaic::STATUS_FAILED);
});

it('only lets staff reveal a finished mosaic', function () {
    $headers = adminHeaders();
    Mosaic::query()->create(['source_path' => 'mosaics/source.jpg', 'status' => Mosaic::STATUS_BUILDING]);

    $this->postJson('/api/admin/mosaic/reveal', [], $headers)->assertUnprocessable();
    expect(app(Settings::class)->get('mosaic_revealed_at'))->toBeNull();
});
