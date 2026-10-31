<?php

namespace App\Console\Commands;

use App\Services\GoogleDriveBackup;
use Illuminate\Console\Command;

class CheckGoogleDrive extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'photobooth:drive-check';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sign in to Google and open the backup folder to confirm Drive backups can run';

    /**
     * Execute the console command.
     */
    public function handle(GoogleDriveBackup $drive): int
    {
        $problem = $drive->check();

        if ($problem !== null) {
            $this->error($problem);

            return self::FAILURE;
        }

        $this->info('Google Drive is connected and the backup folder accepts new files.');

        return self::SUCCESS;
    }
}
