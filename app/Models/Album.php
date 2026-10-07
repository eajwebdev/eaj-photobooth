<?php

namespace App\Models;

use App\Services\Settings;
use Database\Factories\AlbumFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Album extends Model
{
    /** @use HasFactory<AlbumFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = ['code', 'client_uuid', 'guest_name', 'station'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'captures_count' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    /**
     * Album codes are case-insensitive so guests can type "rose-4821".
     *
     * @param  mixed  $value
     * @param  string|null  $field
     */
    public function resolveRouteBinding($value, $field = null): ?self
    {
        return $this->where($field ?? 'code', strtoupper(trim((string) $value)))->first();
    }

    /**
     * @return HasMany<Capture, $this>
     */
    public function captures(): HasMany
    {
        return $this->hasMany(Capture::class);
    }

    public function url(): string
    {
        return rtrim((string) app(Settings::class)->get('share_url'), '/').'/a/'.$this->code;
    }
}
