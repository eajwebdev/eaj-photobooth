<?php

namespace App\Jobs;

use App\Enums\CaptureType;
use App\Models\Capture;
use App\Models\Export;
use App\Services\CaptureFiles;
use App\Services\Settings;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;
use ZipArchive;

/**
 * Packs every capture into one ZIP for the couple: collages, boomerangs and
 * raw shots in folders, guestbook signatures, and a CSV of names and wishes.
 */
class BuildArchiveExport implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public Export $export) {}

    public function handle(Settings $settings, CaptureFiles $files): void
    {
        $private = Storage::disk('local');
        $prefix = (string) $settings->get('download_prefix');

        $relativePath = "exports/{$prefix}-{$this->export->uuid}.zip";
        $zipPath = $private->path($relativePath);
        $private->makeDirectory('exports');
        $private->delete($relativePath);

        $zip = new ZipArchive;
        $csv = fopen('php://temp', 'w+');
        fputcsv($csv, ['number', 'type', 'frame', 'guest_name', 'message', 'album', 'station', 'hidden', 'downloads', 'taken_at', 'file']);

        Capture::query()
            ->with(['album:id,code', 'layout:id,slug', 'shots'])
            ->orderBy('id')
            ->chunkById(200, function ($captures) use ($zip, $zipPath, $files, $prefix, $csv): void {
                // One batch at a time: files downloaded from Drive are read when
                // the archive closes, then deleted before the next batch.
                $this->open($zip, $zipPath);

                foreach ($captures as $capture) {
                    $folder = $capture->type === CaptureType::Collage ? 'collages' : 'boomerangs';
                    $name = "{$folder}/".$capture->downloadName($prefix);

                    $this->addFile($zip, $files->localPath($capture, $capture->media_path), $name);

                    foreach ($capture->shots as $shot) {
                        $this->addFile($zip, $files->localPath($capture, $shot->image_path), sprintf('raw-shots/%04d/%d.jpg', $capture->id, $shot->position));
                    }

                    if ($capture->signature_path !== null) {
                        $this->addFile($zip, $files->localPath($capture, $capture->signature_path), sprintf('signatures/%04d.png', $capture->id));
                    }

                    fputcsv($csv, [
                        $capture->id,
                        $capture->type->value,
                        $capture->layout?->slug,
                        $capture->guest_name,
                        $capture->message,
                        $capture->album?->code,
                        $capture->station,
                        $capture->is_hidden ? 'yes' : 'no',
                        $capture->downloads,
                        $capture->created_at?->toDateTimeString(),
                        $name,
                    ]);
                }

                $zip->close();
                $files->cleanup();
            });

        $this->open($zip, $zipPath);
        rewind($csv);
        $zip->addFromString('guestbook.csv', (string) stream_get_contents($csv));
        fclose($csv);
        $zip->close();

        $this->export->update(['status' => Export::STATUS_READY, 'path' => $relativePath]);
    }

    private function open(ZipArchive $zip, string $path): void
    {
        if ($zip->open($path, ZipArchive::CREATE) !== true) {
            throw new RuntimeException('Could not create the export archive.');
        }
    }

    public function failed(?Throwable $exception): void
    {
        $this->export->update([
            'status' => Export::STATUS_FAILED,
            'error' => mb_substr((string) $exception?->getMessage(), 0, 250),
        ]);
    }

    private function addFile(ZipArchive $zip, ?string $path, string $name): void
    {
        if ($path === null || ! is_file($path)) {
            return;
        }

        $zip->addFile($path, $name);
        // Photos and videos are already compressed; storing them is much faster.
        $zip->setCompressionName($name, ZipArchive::CM_STORE);
    }
}
