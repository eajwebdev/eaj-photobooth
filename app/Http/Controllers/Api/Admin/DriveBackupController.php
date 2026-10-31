<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\BackupCaptureToGoogleDrive;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class DriveBackupController extends Controller
{
    /**
     * Live sign-in and folder test, for the "Test connection" button.
     */
    public function check(GoogleDriveBackup $drive): JsonResponse
    {
        $problem = $drive->check();

        return response()->json(['data' => ['ok' => $problem === null, 'message' => $problem]]);
    }

    /**
     * Puts every capture whose backup gave up back on the backups queue.
     */
    public function retry(GoogleDriveBackup $drive): JsonResponse
    {
        if (! $drive->configured()) {
            return response()->json([
                'message' => 'Google Drive backup is switched off or its settings in .env are incomplete.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $queued = 0;

        Capture::query()
            ->where('drive_backup_status', Capture::DRIVE_BACKUP_FAILED)
            ->chunkById(100, function (Collection $captures) use (&$queued): void {
                foreach ($captures as $capture) {
                    BackupCaptureToGoogleDrive::queueFor($capture);
                    $queued++;
                }
            });

        return response()->json(['data' => ['queued' => $queued]]);
    }
}
