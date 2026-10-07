<?php

namespace Database\Seeders;

use App\Models\Layout;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class LayoutSeeder extends Seeder
{
    /**
     * Upserts every frame from database/data/layouts.json by slug. Frames the
     * couple switched off in admin stay switched off.
     */
    public function run(): void
    {
        /** @var list<array<string, mixed>> $layouts */
        $layouts = json_decode(File::get(database_path('data/layouts.json')), true, flags: JSON_THROW_ON_ERROR);

        foreach ($layouts as $index => $layout) {
            $attributes = [
                'name' => $layout['name'],
                'description' => $layout['description'] ?? null,
                'category' => $layout['category'] ?? 'classic',
                'shots' => count($layout['slots']),
                'canvas_w' => $layout['canvas']['w'],
                'canvas_h' => $layout['canvas']['h'],
                'theme' => $layout['theme'],
                'style' => $layout['style'] ?? null,
                'slots' => $layout['slots'],
                'footer' => $layout['footer'],
                'text' => $layout['text'] ?? null,
                'sort_order' => $index + 1,
            ];

            $existing = Layout::query()->where('slug', $layout['slug'])->first();

            if ($existing !== null) {
                $existing->update($attributes);
            } else {
                Layout::query()->create(['slug' => $layout['slug'], 'is_active' => true, ...$attributes]);
            }
        }
    }
}
