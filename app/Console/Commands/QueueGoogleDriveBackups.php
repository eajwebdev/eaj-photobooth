<?php

namespace App\Console\Commands;

use App\Jobs\BackupCaptureToGoogleDrive;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use Illuminate\Console\Command;

class QueueGoogleDriveBackups extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'photobooth:drive-backup
                            {--force : Queue captures that are already marked complete}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Queue local captures for backup to Google Drive (with PHOTOBOOTH_STORAGE=drive: move every capture still on this server)';

    /**
     * Execute the console command.
     */
    public function handle(GoogleDriveBackup $drive): int
    {
        if (! $drive->configured()) {
            $this->error('Google Drive backup is disabled or its OAuth credentials and folder ID are incomplete.');

            return self::FAILURE;
        }

        $query = Capture::query()->orderBy('id');

        if ($drive->storesPhotos()) {
            // Drive storage: everything still on this server moves, backed up or not.
            $query->whereNull('stored_in_drive_at');
        } elseif (! $this->option('force')) {
            $query->where(function ($pending): void {
                $pending->whereNull('drive_backup_status')
                    ->orWhere('drive_backup_status', '!=', Capture::DRIVE_BACKUP_COMPLETE);
            });
        }

        $queued = 0;

        $query->chunkById(100, function ($captures) use (&$queued): void {
            foreach ($captures as $capture) {
                BackupCaptureToGoogleDrive::queueFor($capture);
                $queued++;
            }
        });

        $this->info("Queued {$queued} capture(s) on the backups queue.");

        return self::SUCCESS;
    }
}
