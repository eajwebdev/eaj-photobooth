<?php

namespace App\Jobs;

use App\Enums\CaptureType;
use App\Enums\GuestGroup;
use App\Models\Capture;
use App\Models\Export;
use App\Services\CaptureFiles;
use App\Services\Settings;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * The couple's printable guestbook (A4): a cover with the arch monogram, one
 * page per guest entry (photo, wish, name and signature), and the totals.
 */
class BuildGuestbookPdf implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public Export $export) {}

    public function handle(Settings $settings, CaptureFiles $files): void
    {
        // Hundreds of photo pages: give the renderer room to work.
        ini_set('memory_limit', '1536M');

        $public = Storage::disk('public');
        $previewWidth = (int) config('photobooth.media.preview_width');
        $fontCache = storage_path('app/private/dompdf');

        if (! is_dir($fontCache)) {
            mkdir($fontCache, 0775, true);
        }

        $entries = Capture::query()
            ->visible()
            ->guestbookEntries()
            ->orderBy('id')
            ->get()
            ->map(function (Capture $capture) use ($files, $previewWidth): array {
                $isBoomerang = $capture->type === CaptureType::Boomerang;

                // Photos in Drive have no preview file; Google resizes the original instead.
                $image = $capture->isStoredInDrive()
                    ? $files->localPath($capture, $isBoomerang ? $capture->poster_path : $capture->media_path, $previewWidth)
                    : $files->localPath($capture, $isBoomerang ? $capture->poster_path : ($capture->preview_path ?? $capture->media_path));

                return [
                    'name' => $capture->guest_name,
                    'message' => $capture->message,
                    'group' => GuestGroup::labelFor($capture->group_tag),
                    'table' => $capture->table_no,
                    'time' => $capture->created_at?->timezone(config('app.timezone'))->format('g:i A'),
                    'image' => $image,
                    'signature' => $files->localPath($capture, $capture->signature_path),
                ];
            });

        $date = $settings->get('wedding_date');

        $pdf = Pdf::loadView('pdf.guestbook', [
            'couple' => $settings->get('couple'),
            'date' => $date ? CarbonImmutable::parse($date)->format('F j, Y') : null,
            'venue' => $settings->get('venue'),
            'hashtag' => $settings->get('hashtag'),
            'thanks' => $settings->get('thank_you_message'),
            'entries' => $entries,
            'stats' => [
                'photos' => Capture::query()->visible()->count(),
                'wishes' => Capture::query()->visible()->whereNotNull('message')->count(),
                'signatures' => Capture::query()->visible()->whereNotNull('signature_path')->count(),
            ],
            'fonts' => resource_path('fonts'),
        ])
            ->setPaper('a4')
            ->setOption([
                'fontDir' => $fontCache,
                'fontCache' => $fontCache,
                'chroot' => [resource_path('fonts'), $public->path(''), base_path()],
                'isRemoteEnabled' => false,
                'dpi' => 150,
                'defaultFont' => 'Jost',
            ]);

        $prefix = (string) $settings->get('download_prefix');
        $relativePath = "exports/{$prefix}-Guestbook-".substr($this->export->uuid, 0, 8).'.pdf';
        Storage::disk('local')->put($relativePath, $pdf->output());
        $files->cleanup();

        $this->export->update(['status' => Export::STATUS_READY, 'path' => $relativePath]);
    }

    public function failed(?Throwable $exception): void
    {
        $this->export->update([
            'status' => Export::STATUS_FAILED,
            'error' => mb_substr((string) $exception?->getMessage(), 0, 250),
        ]);
    }
}
