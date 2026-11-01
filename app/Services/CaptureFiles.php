<?php

namespace App\Services;

use App\Models\Capture;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Psr\Http\Message\StreamInterface;
use Throwable;

/**
 * Hands ZIP builders and the guestbook PDF a file on disk for any capture
 * file, wherever it lives: the server copy when there is one, otherwise a
 * temporary download from Google Drive. Call cleanup() once the files have
 * been read to delete the temporary copies.
 */
class CaptureFiles
{
    private const TEMPORARY_FOLDER = 'tmp/drive';

    private const CHUNK_BYTES = 1024 * 1024;

    /**
     * @var list<string>
     */
    private array $temporary = [];

    public function __construct(private GoogleDriveBackup $drive) {}

    /**
     * Absolute path of a readable copy, or null when the file is gone or Drive
     * could not deliver it. Pass $width to fetch a smaller image from Drive.
     */
    public function localPath(Capture $capture, ?string $path, ?int $width = null): ?string
    {
        if ($path === null) {
            return null;
        }

        $public = Storage::disk('public');

        if ($public->exists($path)) {
            return $public->path($path);
        }

        $fileId = $capture->driveFileId($path);

        if ($fileId === null) {
            return null;
        }

        $target = $this->temporaryPath(pathinfo($path, PATHINFO_EXTENSION) ?: 'bin');

        try {
            if ($width !== null && $capture->isStoredInDrive()) {
                Http::timeout(60)->retry(3, 500)->sink($target)->get((string) $capture->fileUrl($path, $width))->throw();
            } else {
                $this->copyStream($this->drive->download($fileId), $target);
            }
        } catch (Throwable $exception) {
            report($exception);
            @unlink($target);

            return null;
        }

        return $target;
    }

    /**
     * Deletes every temporary copy made since the last cleanup.
     */
    public function cleanup(): void
    {
        foreach ($this->temporary as $path) {
            @unlink($path);
        }

        $this->temporary = [];
    }

    private function temporaryPath(string $extension): string
    {
        $local = Storage::disk('local');
        $local->makeDirectory(self::TEMPORARY_FOLDER);

        return $this->temporary[] = $local->path(self::TEMPORARY_FOLDER.'/'.Str::uuid().'.'.$extension);
    }

    private function copyStream(StreamInterface $stream, string $target): void
    {
        $handle = fopen($target, 'wb');

        try {
            while (! $stream->eof()) {
                fwrite($handle, $stream->read(self::CHUNK_BYTES));
            }
        } finally {
            fclose($handle);
            $stream->close();
        }
    }
}
