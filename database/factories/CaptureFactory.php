<?php

namespace Database\Factories;

use App\Enums\CameraSide;
use App\Enums\CaptureType;
use App\Models\Capture;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Capture>
 */
class CaptureFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $uuid = (string) Str::uuid();

        return [
            'uuid' => $uuid,
            'client_uuid' => fake()->uuid(),
            'type' => CaptureType::Collage,
            'look' => 'classic',
            'media_path' => "captures/20261212/{$uuid}.jpg",
            'mime' => 'image/jpeg',
            'width' => 1200,
            'height' => 1800,
            'size_bytes' => 850_000,
            'guest_name' => fake()->firstName(),
            'message' => null,
            'camera' => CameraSide::Front,
            'station' => 'Main booth',
            'is_hidden' => false,
        ];
    }

    public function boomerang(): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => CaptureType::Boomerang,
            'media_path' => "captures/20261212/{$attributes['uuid']}.mp4",
            'poster_path' => "captures/20261212/{$attributes['uuid']}-poster.jpg",
            'mime' => 'video/mp4',
            'width' => 720,
            'height' => 900,
            'duration_ms' => 4500,
            'look' => null,
        ]);
    }

    public function hidden(): static
    {
        return $this->state(fn (): array => ['is_hidden' => true]);
    }

    /**
     * Moved to Google Drive: the server copies are gone and the gallery loads
     * the photo from Drive. The media file's Drive ID is "drive-media", the
     * poster's (boomerangs) "drive-poster".
     */
    public function storedInDrive(): static
    {
        return $this->state(fn (array $attributes): array => [
            'thumb_path' => "thumbs/20261212/{$attributes['uuid']}.jpg",
            'preview_path' => "previews/20261212/{$attributes['uuid']}.jpg",
            'drive_backup_status' => Capture::DRIVE_BACKUP_COMPLETE,
            'drive_folder_id' => 'capture-folder',
            'drive_files' => array_filter([
                $attributes['media_path'] => 'drive-media',
                ($attributes['poster_path'] ?? '') => isset($attributes['poster_path']) ? 'drive-poster' : null,
            ]),
            'drive_backed_up_at' => now(),
            'stored_in_drive_at' => now(),
        ]);
    }
}
