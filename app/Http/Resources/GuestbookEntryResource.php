<?php

namespace App\Http\Resources;

use App\Models\Capture;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One guestbook entry for the couple: the photo with the guest's name, wish
 * and signature. Only served behind the keepsake PIN.
 *
 * @mixin Capture
 */
class GuestbookEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'type' => $this->type->value,
            'guest_name' => $this->guest_name,
            'message' => $this->message,
            'group_tag' => $this->group_tag,
            'table_no' => $this->table_no,
            'image' => $this->previewUrl(),
            'signature' => $this->fileUrl($this->signature_path),
            'page' => '/p/'.$this->uuid,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
