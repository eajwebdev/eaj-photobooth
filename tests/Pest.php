<?php

use App\Services\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * Multipart fields for a collage upload, built from real JPEG images.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function collagePayload(array $overrides = []): array
{
    return array_merge([
        'client_uuid' => (string) Str::uuid(),
        'type' => 'collage',
        'layout' => 'photo-strip-3',
        'look' => 'ivory',
        'media' => UploadedFile::fake()->image('collage.jpg', 600, 1800),
        'shots' => [
            UploadedFile::fake()->image('1.jpg', 800, 600),
            UploadedFile::fake()->image('2.jpg', 800, 600),
            UploadedFile::fake()->image('3.jpg', 800, 600),
        ],
        'guest_name' => 'Tita Baby',
        'message' => 'Mabuhay ang bagong kasal!',
        'camera' => 'front',
        'station' => 'Main booth',
    ], $overrides);
}

/**
 * Multipart fields for a boomerang upload.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function boomerangPayload(array $overrides = []): array
{
    return array_merge([
        'client_uuid' => (string) Str::uuid(),
        'type' => 'boomerang',
        'media' => UploadedFile::fake()->create('boomerang.mp4', 900, 'video/mp4'),
        'poster' => UploadedFile::fake()->image('poster.jpg', 720, 900),
        'width' => 720,
        'height' => 900,
        'duration_ms' => 4500,
        'camera' => 'back',
        'station' => 'Roaming phone',
    ], $overrides);
}

/**
 * Stores an admin PIN and returns the header that unlocks admin routes.
 *
 * @return array<string, string>
 */
function adminHeaders(string $pin = '2468'): array
{
    app(Settings::class)->setPin('admin', $pin);

    return ['X-Admin-Pin' => $pin];
}
