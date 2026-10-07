<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capture;
use App\Services\Settings;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CaptureDownloadController extends Controller
{
    /**
     * The full-quality file with a friendly name, e.g. "Edwin-Jochel-Wedding-0041.jpg".
     */
    public function __invoke(Capture $capture, Settings $settings): StreamedResponse
    {
        abort_if($capture->is_hidden, Response::HTTP_NOT_FOUND);

        $disk = Storage::disk('public');
        abort_unless($disk->exists($capture->media_path), Response::HTTP_NOT_FOUND);

        $capture->increment('downloads');

        return $disk->download(
            $capture->media_path,
            $capture->downloadName((string) $settings->get('download_prefix')),
            ['Content-Type' => $capture->mime, 'Cache-Control' => 'private, max-age=86400'],
        );
    }
}
