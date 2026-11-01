<?php

namespace App\Jobs;

use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Copies a capture to Google Drive. In Drive storage mode it then deletes the
 * server copies, and the gallery loads the photo from Drive from then on.
 */
class BackupCaptureToGoogleDrive implements ShouldQueue
{
    use Queueable;

    public int $tries = 8;

    /** @var list<int> */
    public array $backoff = [60, 300, 900, 1800, 3600];

    public int $timeout = 600;

    public bool $failOnTimeout = true;

    public function __construct(public Capture $capture)
    {
        $this->onQueue('backups');
        $this->afterCommit();
    }

    /**
     * Seconds to wait for the gallery thumbnail before moving files off the server.
     */
    private const DERIVATIVES_WAIT_SECONDS = 30;

    public function handle(GoogleDriveBackup $drive): void
    {
        $capture = $this->capture->fresh(['shots']);
        $moveToDrive = $drive->storesPhotos();

        if ($capture === null || $capture->isStoredInDrive()) {
            return;
        }

        if ($capture->drive_backup_status === Capture::DRIVE_BACKUP_COMPLETE && ! $moveToDrive) {
            return;
        }

        // The thumbnail job reads the local photo; let it finish before the files leave.
        if ($moveToDrive && $capture->thumb_path === null && $this->attempts() < 3) {
            $this->release(self::DERIVATIVES_WAIT_SECONDS);

            return;
        }

        $capture->update([
            'drive_backup_status' => Capture::DRIVE_BACKUP_PROCESSING,
            'drive_backup_error' => null,
        ]);

        try {
            $result = $drive->backup($capture);

            $capture->update([
                'drive_backup_status' => Capture::DRIVE_BACKUP_COMPLETE,
                'drive_folder_id' => $result['folder_id'],
                'drive_files' => $result['files'],
                'drive_backed_up_at' => now(),
                'drive_backup_error' => null,
                'stored_in_drive_at' => $moveToDrive ? now() : null,
            ]);

            if ($moveToDrive) {
                Storage::disk('public')->delete($capture->storedPaths());
            }
        } catch (Throwable $exception) {
            $capture->update([
                'drive_backup_status' => Capture::DRIVE_BACKUP_PENDING,
                'drive_backup_error' => mb_substr($drive->explain($exception), 0, 1000),
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->capture->fresh()?->update([
            'drive_backup_status' => Capture::DRIVE_BACKUP_FAILED,
            'drive_backup_error' => $exception === null
                ? 'The backup stopped without an error message.'
                : mb_substr(app(GoogleDriveBackup::class)->explain($exception), 0, 1000),
        ]);
    }

    /**
     * Marks the capture as waiting and puts it on the backups queue.
     */
    public static function queueFor(Capture $capture): void
    {
        $capture->update([
            'drive_backup_status' => Capture::DRIVE_BACKUP_PENDING,
            'drive_backup_error' => null,
        ]);

        static::dispatch($capture);
    }
}
