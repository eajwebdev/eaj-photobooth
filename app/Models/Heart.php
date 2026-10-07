<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Heart extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['capture_id', 'device_id'];

    /**
     * @return BelongsTo<Capture, $this>
     */
    public function capture(): BelongsTo
    {
        return $this->belongsTo(Capture::class);
    }
}
