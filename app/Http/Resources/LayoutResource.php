<?php

namespace App\Http\Resources;

use App\Models\Layout;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Layout
 */
class LayoutResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category,
            'shots' => $this->shots,
            'canvas' => ['w' => $this->canvas_w, 'h' => $this->canvas_h],
            'theme' => $this->theme,
            'style' => $this->style,
            'slots' => $this->slots,
            'footer' => $this->footer,
            'text' => $this->text,
            'sort_order' => $this->sort_order,
            'is_active' => $this->is_active,
        ];
    }
}
