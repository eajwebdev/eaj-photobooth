<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use App\Services\Settings;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class CaptureDownloadController extends Controller
{
    private const CHUNK_BYTES = 1024 * 1024;

    /**
     * The full-quality file with a friendly name, e.g. "Edwin-Jochel-Wedding-0041.jpg",
     * from this server or, once the photo lives in Google Drive, streamed from there.
     */
    public function __invoke(Capture $capture, Settings $settings, GoogleDriveBackup $drive): StreamedResponse
    {
        abort_if($capture->is_hidden, Response::HTTP_NOT_FOUND);

        $disk = Storage::disk('public');
        $name = $capture->downloadName((string) $settings->get('download_prefix'));
        $headers = ['Content-Type' => $capture->mime, 'Cache-Control' => 'private, max-age=86400'];

        if ($disk->exists($capture->media_path)) {
            $capture->increment('downloads');

            return $disk->download($capture->media_path, $name, $headers);
        }

        $fileId = $capture->driveFileId($capture->media_path);
        abort_if($fileId === null, Response::HTTP_NOT_FOUND);

        try {
            $stream = $drive->download($fileId);
        } catch (Throwable $exception) {
            report($exception);
            abort(Response::HTTP_SERVICE_UNAVAILABLE, 'This photo could not be fetched from Google Drive right now. Please try again in a moment.');
        }

        $capture->increment('downloads');

        return response()->streamDownload(function () use ($stream): void {
            while (! $stream->eof()) {
                echo $stream->read(self::CHUNK_BYTES);
                flush();
            }

            $stream->close();
        }, $name, $headers);
    }
}
