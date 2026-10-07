<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Challenge extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['title', 'sort', 'is_active'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort' => 'integer',
        ];
    }

    /**
     * @return HasMany<Capture, $this>
     */
    public function captures(): HasMany
    {
        return $this->hasMany(Capture::class);
    }
}
