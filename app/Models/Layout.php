<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Layout extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'slug', 'name', 'description', 'category', 'shots', 'canvas_w', 'canvas_h',
        'theme', 'style', 'slots', 'footer', 'text', 'sort_order', 'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'slots' => 'array',
            'footer' => 'array',
            'text' => 'array',
            'is_active' => 'boolean',
            'shots' => 'integer',
            'canvas_w' => 'integer',
            'canvas_h' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @param  Builder<Layout>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * @return HasMany<Capture, $this>
     */
    public function captures(): HasMany
    {
        return $this->hasMany(Capture::class);
    }
}
