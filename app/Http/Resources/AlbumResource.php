<?php

namespace App\Http\Resources;

use App\Models\Album;
use App\Models\Challenge;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Album
 */
class AlbumResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'code' => $this->code,
            'client_uuid' => $this->client_uuid,
            'url' => $this->url(),
            'guest_name' => $this->guest_name,
            'captures_count' => $this->captures_count,
            'zip_url' => '/api/albums/'.$this->code.'/zip',
            'captures' => $this->whenLoaded('captures', fn (): array => CaptureResource::collection($this->captures)->resolve()),
            'challenges' => $this->whenLoaded('captures', fn (): array => [
                'done' => $this->captures->pluck('challenge_id')->filter()->unique()->count(),
                'total' => Challenge::query()->where('is_active', true)->count(),
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
