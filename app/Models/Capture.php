<?php

namespace App\Models;

use App\Enums\CameraSide;
use App\Enums\CaptureType;
use Database\Factories\CaptureFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Capture extends Model
{
    /** @use HasFactory<CaptureFactory> */
    use HasFactory;

    public const DRIVE_BACKUP_PENDING = 'pending';

    public const DRIVE_BACKUP_PROCESSING = 'processing';

    public const DRIVE_BACKUP_COMPLETE = 'complete';

    public const DRIVE_BACKUP_FAILED = 'failed';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid', 'client_uuid', 'type', 'layout_id', 'album_id', 'look',
        'media_path', 'poster_path', 'thumb_path', 'preview_path', 'dominant_color',
        'mime', 'width', 'height', 'duration_ms', 'size_bytes',
        'guest_name', 'message', 'signature_path', 'camera', 'station', 'device', 'ip',
        'is_hidden', 'group_tag', 'table_no', 'challenge_id', 'is_couple_favourite',
        'drive_backup_status', 'drive_folder_id', 'drive_backed_up_at', 'drive_backup_error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => CaptureType::class,
            'camera' => CameraSide::class,
            'is_hidden' => 'boolean',
            'is_couple_favourite' => 'boolean',
            'width' => 'integer',
            'height' => 'integer',
            'duration_ms' => 'integer',
            'size_bytes' => 'integer',
            'downloads' => 'integer',
            'hearts_count' => 'integer',
            'table_no' => 'integer',
            'drive_backed_up_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * @param  Builder<Capture>  $query
     */
    #[Scope]
    protected function visible(Builder $query): void
    {
        $query->where('is_hidden', false);
    }

    /**
     * Captures that belong in the guestbook: a name, a wish or a signature.
     *
     * @param  Builder<Capture>  $query
     */
    #[Scope]
    protected function guestbookEntries(Builder $query): void
    {
        $query->where(fn (Builder $entry) => $entry
            ->whereNotNull('guest_name')
            ->orWhereNotNull('message')
            ->orWhereNotNull('signature_path'));
    }

    /**
     * @return BelongsTo<Layout, $this>
     */
    public function layout(): BelongsTo
    {
        return $this->belongsTo(Layout::class);
    }

    /**
     * @return BelongsTo<Album, $this>
     */
    public function album(): BelongsTo
    {
        return $this->belongsTo(Album::class);
    }

    /**
     * @return BelongsTo<Challenge, $this>
     */
    public function challenge(): BelongsTo
    {
        return $this->belongsTo(Challenge::class);
    }

    /**
     * @return HasMany<CaptureShot, $this>
     */
    public function shots(): HasMany
    {
        return $this->hasMany(CaptureShot::class)->orderBy('position');
    }

    /**
     * Relative /storage URL for a file on the public disk, so links keep working
     * whichever host name or tunnel the guest opened the app through.
     */
    public static function publicUrl(?string $path): ?string
    {
        return $path === null ? null : '/storage/'.ltrim($path, '/');
    }

    /**
     * Every file this capture owns on the public disk.
     *
     * @return list<string>
     */
    public function storedPaths(): array
    {
        return array_values(array_filter([
            $this->media_path,
            $this->poster_path,
            $this->thumb_path,
            $this->preview_path,
            $this->signature_path,
            ...$this->shots->pluck('image_path')->all(),
        ]));
    }

    public function deleteWithFiles(): void
    {
        Storage::disk('public')->delete($this->storedPaths());

        if ($this->album_id !== null) {
            Album::whereKey($this->album_id)->where('captures_count', '>', 0)->decrement('captures_count');
        }

        $this->delete();
    }

    /**
     * Friendly download name, e.g. "Edwin-Jochel-Wedding-0041.jpg".
     */
    public function downloadName(string $prefix): string
    {
        $extension = pathinfo($this->media_path, PATHINFO_EXTENSION) ?: 'jpg';

        return sprintf('%s-%04d.%s', $prefix, $this->id, $extension);
    }
}
