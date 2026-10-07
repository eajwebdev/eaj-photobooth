<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Services\Settings;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use ZipArchive;

class AlbumZipController extends Controller
{
    /**
     * Packs the album's visible photos and boomerangs (full quality) into a ZIP.
     */
    public function __invoke(Album $album, Settings $settings): BinaryFileResponse
    {
        abort_unless((bool) $settings->get('allow_zip_downloads'), Response::HTTP_FORBIDDEN, 'Downloading albums as a ZIP is turned off. You can still download each photo.');

        $captures = $album->captures()->visible()->orderBy('id')->get();
        abort_if($captures->isEmpty(), Response::HTTP_NOT_FOUND, 'This album has no photos yet.');

        $prefix = (string) $settings->get('download_prefix');
        $public = Storage::disk('public');
        $private = Storage::disk('local');
        $private->makeDirectory('tmp');
        $zipPath = $private->path('tmp/album-'.Str::uuid().'.zip');

        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach ($captures as $capture) {
            $path = $public->path($capture->media_path);

            if (is_file($path)) {
                $name = $capture->downloadName($prefix);
                $zip->addFile($path, $name);
                $zip->setCompressionName($name, ZipArchive::CM_STORE);
            }
        }

        $zip->close();

        return response()
            ->download($zipPath, "{$prefix}-{$album->code}.zip", ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend();
    }
}
