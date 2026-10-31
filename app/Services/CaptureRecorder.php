<?php

namespace App\Services;

use App\Enums\CameraSide;
use App\Enums\CaptureType;
use App\Http\Requests\StoreCaptureRequest;
use App\Jobs\BackupCaptureToGoogleDrive;
use App\Jobs\GenerateCaptureDerivatives;
use App\Models\Album;
use App\Models\Capture;
use App\Models\Layout;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores an uploaded collage or boomerang, its raw shots and signature,
 * attaches it to the guest album and queues the gallery derivatives.
 */
class CaptureRecorder
{
    public function __construct(
        private AlbumRegistry $albums,
        private ImageDerivatives $images,
    ) {}

    /**
     * @return array{capture: Capture, created: bool}
     */
    public function record(StoreCaptureRequest $request): array
    {
        $type = $request->captureType();
        $uuid = (string) Str::uuid();
        $folder = now()->format('Ymd');
        $disk = Storage::disk('public');

        /** @var UploadedFile $media */
        $media = $request->file('media');
        $mediaExtension = $this->extensionFor($media, $type);
        $mediaPath = $disk->putFileAs("captures/{$folder}", $media, "{$uuid}.{$mediaExtension}");

        $posterPath = null;
        if ($request->hasFile('poster')) {
            $posterPath = $disk->putFileAs("captures/{$folder}", $request->file('poster'), "{$uuid}-poster.jpg");
        }

        $signaturePath = null;
        if ($request->hasFile('signature')) {
            $signaturePath = $disk->putFileAs('signatures', $request->file('signature'), "{$uuid}.png");
        }

        $shotPaths = [];
        foreach (array_values($request->file('shots', [])) as $index => $shot) {
            $shotPaths[$index + 1] = $disk->putFileAs("shots/{$folder}/{$uuid}", $shot, ($index + 1).'.jpg');
        }

        $storedPaths = array_values(array_filter([$mediaPath, $posterPath, $signaturePath, ...$shotPaths]));
        $dimensions = $this->dimensionsFor($request, $type, $disk->path($posterPath ?? $mediaPath));

        $album = null;
        if ($request->filled('album_client_uuid')) {
            $album = $this->albums->findOrCreate(
                (string) $request->input('album_client_uuid'),
                $request->input('guest_name'),
                $request->input('station'),
            )['album'];
        }

        try {
            $capture = DB::transaction(function () use (
                $request, $type, $uuid, $mediaPath, $posterPath, $signaturePath, $shotPaths, $dimensions, $album, $media
            ): Capture {
                $capture = Capture::query()->create([
                    'uuid' => $uuid,
                    'client_uuid' => $request->input('client_uuid'),
                    'type' => $type,
                    'layout_id' => $type === CaptureType::Collage
                        ? Layout::query()->where('slug', $request->input('layout'))->value('id')
                        : null,
                    'album_id' => $album?->id,
                    'look' => $request->input('look'),
                    'media_path' => $mediaPath,
                    'poster_path' => $posterPath,
                    'mime' => (string) $media->getMimeType(),
                    'width' => $dimensions['width'],
                    'height' => $dimensions['height'],
                    'duration_ms' => $request->filled('duration_ms') ? $request->integer('duration_ms') : null,
                    'size_bytes' => (int) $media->getSize(),
                    'guest_name' => $this->clean($request->input('guest_name')),
                    'message' => $this->clean($request->input('message')),
                    'signature_path' => $signaturePath,
                    'camera' => $request->input('camera', CameraSide::Front->value),
                    'station' => $request->input('station'),
                    'device' => Str::limit((string) $request->userAgent(), 157),
                    'ip' => $request->ip(),
                    'group_tag' => $request->input('group_tag'),
                    'table_no' => $request->filled('table_no') ? $request->integer('table_no') : null,
                    'challenge_id' => $request->filled('challenge_id') ? $request->integer('challenge_id') : null,
                ]);

                foreach ($shotPaths as $position => $path) {
                    $capture->shots()->create(['position' => $position, 'image_path' => $path]);
                }

                if ($album !== null) {
                    Album::query()->whereKey($album->id)->increment('captures_count');
                }

                return $capture;
            });
        } catch (UniqueConstraintViolationException) {
            // The same capture arrived twice at once; keep the first copy only.
            $disk->delete($storedPaths);

            return [
                'capture' => Capture::query()->where('client_uuid', $request->input('client_uuid'))->firstOrFail(),
                'created' => false,
            ];
        }

        GenerateCaptureDerivatives::dispatch($capture);

        if (config('services.google_drive.backup_enabled')) {
            BackupCaptureToGoogleDrive::queueFor($capture);
        }

        return ['capture' => $capture, 'created' => true];
    }

    /**
     * Collages are measured from the file; boomerangs trust the size the booth
     * recorded the clip at, falling back to the poster image.
     *
     * @return array{width: int|null, height: int|null}
     */
    private function dimensionsFor(StoreCaptureRequest $request, CaptureType $type, string $imagePath): array
    {
        if ($type === CaptureType::Boomerang && $request->filled(['width', 'height'])) {
            return ['width' => $request->integer('width'), 'height' => $request->integer('height')];
        }

        return $this->images->dimensions($imagePath) ?? ['width' => null, 'height' => null];
    }

    private function extensionFor(UploadedFile $file, CaptureType $type): string
    {
        if ($type === CaptureType::Collage) {
            return 'jpg';
        }

        return match ($file->getMimeType()) {
            'video/mp4' => 'mp4',
            'image/gif' => 'gif',
            default => 'webm',
        };
    }

    private function clean(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
