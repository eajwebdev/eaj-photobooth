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
}
