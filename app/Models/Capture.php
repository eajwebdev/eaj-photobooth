<?php

namespace App\Models;

use App\Enums\CameraSide;
use App\Enums\CaptureType;
use App\Services\GoogleDriveBackup;
use Database\Factories\CaptureFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Throwable;

class Capture extends Model
{
    /** @use HasFactory<CaptureFactory> */
    use HasFactory;

    public const DRIVE_BACKUP_PENDING = 'pending';

    public const DRIVE_BACKUP_PROCESSING = 'processing';

    public const DRIVE_BACKUP_COMPLETE = 'complete';

    public const DRIVE_BACKUP_FAILED = 'failed';

    /**
     * Types Google's image servers can resize and serve directly.
     */
    private const DRIVE_IMAGE_MIMES = ['image/jpeg', 'image/png'];

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
        'drive_files', 'stored_in_drive_at',
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
            'drive_files' => 'array',
            'stored_in_drive_at' => 'datetime',
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
     * Where the browser loads one of this capture's files: Google's image
     * servers once it lives in Drive (resized to $width when given), otherwise
     * this server's /storage. Drive serves only JPEG/PNG through its image
     * servers; boomerang videos and GIFs go through the Drive download link.
     */
    public function fileUrl(?string $path, ?int $width = null): ?string
    {
        if ($path === null) {
            return null;
        }

        $fileId = $this->isStoredInDrive() ? $this->driveFileId($path) : null;

        if ($fileId === null) {
            return self::publicUrl($path);
        }

        if ($path === $this->media_path && ! in_array($this->mime, self::DRIVE_IMAGE_MIMES, true)) {
            return 'https://drive.google.com/uc?export=download&id='.rawurlencode($fileId);
        }

        return sprintf('https://lh3.googleusercontent.com/d/%s=%s', rawurlencode($fileId), $width === null ? 's0' : "w{$width}");
    }

    /**
     * The 520px gallery tile. Drive resizes on the fly, so no thumbnail is kept there.
     */
    public function thumbUrl(): ?string
    {
        return $this->derivativeUrl($this->thumb_path, (int) config('photobooth.media.thumb_width'));
    }

    /**
     * The 1080px lightbox and slideshow image.
     */
    public function previewUrl(): ?string
    {
        return $this->derivativeUrl($this->preview_path, (int) config('photobooth.media.preview_width'));
    }

    public function driveFileId(?string $path): ?string
    {
        $fileId = $path === null ? null : ($this->drive_files[$path] ?? null);

        return is_string($fileId) && $fileId !== '' ? $fileId : null;
    }

    public function isStoredInDrive(): bool
    {
        return $this->stored_in_drive_at !== null;
    }

    private function derivativeUrl(?string $derivativePath, int $width): ?string
    {
        $source = $this->poster_path ?? $this->media_path;

        if ($this->isStoredInDrive() && $this->driveFileId($source) !== null) {
            return $this->fileUrl($source, $width);
        }

        return self::publicUrl($derivativePath ?? $source);
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

    /**
     * Deletes the capture and its files. A photo that lives in Google Drive
     * goes to the Drive trash, where it can be restored for 30 days.
     */
    public function deleteWithFiles(): void
    {
        Storage::disk('public')->delete($this->storedPaths());

        if ($this->isStoredInDrive() && $this->drive_folder_id !== null) {
            try {
                app(GoogleDriveBackup::class)->trash($this->drive_folder_id);
            } catch (Throwable $exception) {
                // The guest-facing photo is gone either way; staff can tidy Drive by hand.
                report($exception);
            }
        }

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
