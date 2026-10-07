<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\BuildArchiveExport;
use App\Jobs\BuildGuestbookPdf;
use App\Models\Export;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Queued downloads for staff and the couple: the full archive ZIP, and the
 * guestbook PDF. Built in the background; collected through a signed link.
 */
class ExportController extends Controller
{
    public const KIND_ARCHIVE = 'archive';

    public const KIND_GUESTBOOK = 'guestbook';

    public function store(Request $request): JsonResponse
    {
        $kind = $request->validate([
            'kind' => ['sometimes', Rule::in([self::KIND_ARCHIVE, self::KIND_GUESTBOOK])],
        ])['kind'] ?? self::KIND_ARCHIVE;

        $export = Export::query()->create([
            'uuid' => (string) Str::uuid(),
            'kind' => $kind,
            'status' => Export::STATUS_PENDING,
        ]);

        $kind === self::KIND_GUESTBOOK ? BuildGuestbookPdf::dispatch($export) : BuildArchiveExport::dispatch($export);

        return $this->present($export->refresh(), Response::HTTP_ACCEPTED);
    }

    public function show(Export $export): JsonResponse
    {
        return $this->present($export);
    }

    /**
     * Reached through a signed link, so a plain <a href> can download it.
     */
    public function download(Export $export): StreamedResponse
    {
        abort_unless($export->status === Export::STATUS_READY && $export->path !== null, Response::HTTP_NOT_FOUND);

        return Storage::disk('local')->download($export->path, basename($export->path));
    }

    private function present(Export $export, int $status = Response::HTTP_OK): JsonResponse
    {
        return response()->json([
            'data' => [
                'uuid' => $export->uuid,
                'kind' => $export->kind,
                'status' => $export->status,
                'error' => $export->error,
                'download_url' => $export->status === Export::STATUS_READY
                    ? URL::temporarySignedRoute('exports.download', now()->addHours(2), ['export' => $export->uuid], absolute: false)
                    : null,
                'created_at' => $export->created_at?->toIso8601String(),
            ],
        ], $status);
    }
}
