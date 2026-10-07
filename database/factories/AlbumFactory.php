<?php

namespace Database\Factories;

use App\Models\Album;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Album>
 */
class AlbumFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->randomElement(config('photobooth.album_words')).'-'.fake()->unique()->numerify('%%%%'),
            'client_uuid' => fake()->uuid(),
            'guest_name' => fake()->firstName(),
            'station' => 'Main booth',
        ];
    }
}
