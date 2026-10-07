<?php

namespace App\Services;

use App\Models\Album;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Finds or opens the guest album a booth session belongs to.
 *
 * The booth creates the album's client_uuid itself (so it works offline);
 * the readable code is assigned the first time the server hears about it.
 */
class AlbumRegistry
{
    private const MAX_ATTEMPTS = 5;

    public function __construct(private AlbumCodeGenerator $codes) {}

    /**
     * @return array{album: Album, created: bool}
     */
    public function findOrCreate(string $clientUuid, ?string $guestName = null, ?string $station = null): array
    {
        for ($attempt = 1; ; $attempt++) {
            $existing = Album::query()->where('client_uuid', $clientUuid)->first();

            if ($existing !== null) {
                if ($existing->guest_name === null && $guestName !== null) {
                    $existing->update(['guest_name' => $guestName]);
                }

                return ['album' => $existing, 'created' => false];
            }

            try {
                $album = Album::query()->create([
                    'client_uuid' => $clientUuid,
                    'code' => $this->codes->generate(),
                    'guest_name' => $guestName,
                    'station' => $station,
                ]);

                return ['album' => $album, 'created' => true];
            } catch (UniqueConstraintViolationException $exception) {
                // Either another request created this album a moment ago, or two
                // albums drew the same code. Loop: the first case returns it above.
                if ($attempt >= self::MAX_ATTEMPTS) {
                    throw $exception;
                }
            }
        }
    }
}
