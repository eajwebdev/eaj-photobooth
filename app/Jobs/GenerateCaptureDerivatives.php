<?php

namespace App\Jobs;

use App\Models\Capture;
use App\Services\ImageDerivatives;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;

/**
 * Builds the 520px gallery thumbnail, the 1080px lightbox preview and the
 * dominant colour placeholder. Safe to run more than once.
 */
class GenerateCaptureDerivatives implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /**
     * @var list<int>
     */
    public array $backoff = [5, 30];

    public int $timeout = 60;

    public function __construct(public Capture $capture)
    {
        $this->afterCommit();
    }

    public function handle(ImageDerivatives $images): void
    {
        $disk = Storage::disk('public');
        $source = $this->capture->poster_path ?? $this->capture->media_path;

        if (! $disk->exists($source)) {
            return;
        }

        $bytes = (string) $disk->get($source);
        $media = config('photobooth.media');
        $folder = $this->capture->created_at?->format('Ymd') ?? now()->format('Ymd');

        $thumbPath = "thumbs/{$folder}/{$this->capture->uuid}.jpg";
        $previewPath = "previews/{$folder}/{$this->capture->uuid}.jpg";

        $disk->put($thumbPath, $images->resizedJpeg($bytes, $media['thumb_width'], $media['thumb_max_bytes'])['bytes']);
        $disk->put($previewPath, $images->resizedJpeg($bytes, $media['preview_width'], $media['preview_max_bytes'])['bytes']);

        $this->capture->forceFill([
            'thumb_path' => $thumbPath,
            'preview_path' => $previewPath,
            'dominant_color' => $images->dominantColor($bytes),
        ])->save();
    }
}
