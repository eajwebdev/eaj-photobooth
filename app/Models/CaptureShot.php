<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CaptureShot extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['position', 'image_path'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Capture, $this>
     */
    public function capture(): BelongsTo
    {
        return $this->belongsTo(Capture::class);
    }
}
