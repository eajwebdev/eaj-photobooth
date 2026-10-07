<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Export extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_READY = 'ready';

    public const STATUS_FAILED = 'failed';

    /**
     * @var list<string>
     */
    protected $fillable = ['uuid', 'kind', 'status', 'path', 'error'];

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
}
