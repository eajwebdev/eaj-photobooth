<?php

namespace App\Http\Resources;

use App\Models\Capture;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Capture
 */
class CaptureResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'client_uuid' => $this->client_uuid,
            'type' => $this->type->value,
            'layout' => $this->whenLoaded('layout', fn () => $this->layout?->slug),
            'album' => $this->whenLoaded('album', fn () => $this->album?->code),
            'look' => $this->look,
            'mime' => $this->mime,
            'width' => $this->width,
            'height' => $this->height,
            'duration_ms' => $this->duration_ms,
            'guest_name' => $this->guest_name,
            'message' => $this->message,
            'camera' => $this->camera->value,
            'dominant_color' => $this->dominant_color,
            'group_tag' => $this->group_tag,
            'table_no' => $this->table_no,
            'challenge_id' => $this->challenge_id,
            'hearts_count' => $this->hearts_count,
            'is_couple_favourite' => $this->is_couple_favourite,
            'is_hidden' => $this->is_hidden,
            'station' => $this->station,
            'urls' => [
                'media' => $this->fileUrl($this->media_path),
                'poster' => $this->fileUrl($this->poster_path),
                'thumb' => $this->thumbUrl(),
                'preview' => $this->previewUrl(),
                'page' => '/p/'.$this->uuid,
                'download' => '/api/captures/'.$this->uuid.'/download',
            ],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
