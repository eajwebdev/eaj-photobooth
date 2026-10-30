<?php

namespace App\Services;

use App\Models\Capture;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use JsonException;
use RuntimeException;

class GoogleDriveBackup
{
    private const DRIVE_API = 'https://www.googleapis.com/drive/v3';

    private const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    public function enabled(): bool
    {
        return (bool) config('services.google_drive.backup_enabled');
    }

    public function configured(): bool
    {
        return $this->enabled()
            && $this->configurationValue('client_id') !== null
            && $this->configurationValue('client_secret') !== null
            && $this->configurationValue('refresh_token') !== null
            && $this->configurationValue('folder_id') !== null;
    }

    public function backup(Capture $capture): string
    {
        if (! $this->configured()) {
            throw new RuntimeException('Google Drive backup is enabled but its OAuth credentials or folder ID are incomplete.');
        }

        $capture->loadMissing('shots');
        $folderId = $capture->drive_folder_id ?: $this->findOrCreateCaptureFolder($capture);

        foreach ($this->filesFor($capture) as $file) {
            $this->uploadOnce($folderId, $file['path'], $file['name'], $capture->uuid);
        }

        return $folderId;
    }

    private function findOrCreateCaptureFolder(Capture $capture): string
    {
        $parentId = $this->configurationValue('folder_id');
        $query = sprintf(
            "mimeType = 'application/vnd.google-apps.folder' and trashed = false and '%s' in parents and appProperties has { key='photobooth_capture_uuid' and value='%s' }",
            $this->escapeQueryValue((string) $parentId),
            $this->escapeQueryValue($capture->uuid),
        );

        $existing = $this->request()->get(self::DRIVE_API.'/files', [
            'q' => $query,
            'fields' => 'files(id)',
            'pageSize' => 1,
            'spaces' => 'drive',
            'supportsAllDrives' => 'true',
            'includeItemsFromAllDrives' => 'true',
        ])->throw()->json('files.0.id');

        if (is_string($existing) && $existing !== '') {
            return $existing;
        }

        $name = sprintf(
            '%s - %04d - %s',
            $capture->created_at?->format('Y-m-d') ?? now()->format('Y-m-d'),
            $capture->id,
            $capture->type->value,
        );

        $folderId = $this->request()->post(self::DRIVE_API.'/files?supportsAllDrives=true&fields=id', [
            'name' => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId],
            'appProperties' => [
                'photobooth_capture_uuid' => $capture->uuid,
            ],
        ])->throw()->json('id');

        if (! is_string($folderId) || $folderId === '') {
            throw new RuntimeException('Google Drive did not return an ID for the capture folder.');
        }

        return $folderId;
    }

    /**
     * @return list<array{path: string, name: string}>
     */
    private function filesFor(Capture $capture): array
    {
        $extension = pathinfo($capture->media_path, PATHINFO_EXTENSION) ?: 'bin';
        $files = [[
            'path' => $capture->media_path,
            'name' => sprintf('capture-%04d.%s', $capture->id, $extension),
        ]];

        if ($capture->poster_path !== null) {
            $files[] = ['path' => $capture->poster_path, 'name' => 'poster.jpg'];
        }

        if ($capture->signature_path !== null) {
            $files[] = ['path' => $capture->signature_path, 'name' => 'signature.png'];
        }

        foreach ($capture->shots as $shot) {
            $files[] = [
                'path' => $shot->image_path,
                'name' => sprintf('shot-%02d.jpg', $shot->position),
            ];
        }

        return $files;
    }

    private function uploadOnce(string $folderId, string $path, string $name, string $captureUuid): void
    {
        $disk = Storage::disk('public');

        if (! $disk->exists($path)) {
            throw new RuntimeException("The local backup source is missing: {$path}");
        }

        $sourceHash = sha1($path);
        $query = sprintf(
            "trashed = false and '%s' in parents and appProperties has { key='photobooth_source_hash' and value='%s' }",
            $this->escapeQueryValue($folderId),
            $sourceHash,
        );

        $existing = $this->request()->get(self::DRIVE_API.'/files', [
            'q' => $query,
            'fields' => 'files(id)',
            'pageSize' => 1,
            'spaces' => 'drive',
            'supportsAllDrives' => 'true',
            'includeItemsFromAllDrives' => 'true',
        ])->throw()->json('files.0.id');

        if (is_string($existing) && $existing !== '') {
            return;
        }

        $mime = $disk->mimeType($path) ?: 'application/octet-stream';
        $metadata = [
            'name' => $name,
            'parents' => [$folderId],
            'appProperties' => [
                'photobooth_capture_uuid' => $captureUuid,
                'photobooth_source_hash' => $sourceHash,
            ],
        ];

        $this->multipartUpload($metadata, $mime, (string) $disk->get($path));
    }

    /**
     * @param  array<string, mixed>  $metadata
     *
     * @throws JsonException
     */
    private function multipartUpload(array $metadata, string $mime, string $bytes): void
    {
        $boundary = 'photobooth_'.Str::random(32);
        $body = "--{$boundary}\r\n"
            ."Content-Type: application/json; charset=UTF-8\r\n\r\n"
            .json_encode($metadata, JSON_THROW_ON_ERROR)."\r\n"
            ."--{$boundary}\r\n"
            ."Content-Type: {$mime}\r\n\r\n"
            .$bytes."\r\n"
            ."--{$boundary}--";

        $this->request()
            ->withBody($body, "multipart/related; boundary={$boundary}")
            ->post(self::DRIVE_UPLOAD_API.'/files?uploadType=multipart&supportsAllDrives=true&fields=id')
            ->throw();
    }

    private function request(): PendingRequest
    {
        return Http::withToken($this->accessToken())
            ->acceptJson()
            ->asJson()
            ->timeout(120)
            ->connectTimeout(15)
            ->retry(3, 500, throw: false);
    }

    private function accessToken(): string
    {
        $clientId = (string) $this->configurationValue('client_id');

        return Cache::remember('google-drive.access-token.'.sha1($clientId), now()->addMinutes(50), function (): string {
            $response = Http::asForm()
                ->acceptJson()
                ->timeout(30)
                ->retry(3, 500, throw: false)
                ->post(self::TOKEN_URL, [
                    'client_id' => $this->configurationValue('client_id'),
                    'client_secret' => $this->configurationValue('client_secret'),
                    'refresh_token' => $this->configurationValue('refresh_token'),
                    'grant_type' => 'refresh_token',
                ])
                ->throw();

            $token = $response->json('access_token');

            if (! is_string($token) || $token === '') {
                throw new RuntimeException('Google OAuth did not return an access token.');
            }

            return $token;
        });
    }

    private function configurationValue(string $key): ?string
    {
        $value = config("services.google_drive.{$key}");

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    private function escapeQueryValue(string $value): string
    {
        return str_replace(['\\', "'"], ['\\\\', "\\'"], $value);
    }
}
