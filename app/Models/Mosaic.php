<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mosaic extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_BUILDING = 'building';

    public const STATUS_READY = 'ready';

    public const STATUS_FAILED = 'failed';

    /**
     * @var list<string>
     */
    protected $fillable = ['source_path', 'output_path', 'preview_path', 'status', 'error', 'tiles', 'built_at'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'built_at' => 'datetime',
            'tiles' => 'integer',
        ];
    }
}
