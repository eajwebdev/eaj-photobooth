<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\Capture;
use App\Services\StationMonitor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function __invoke(StationMonitor $monitor): JsonResponse
    {
        $byType = Capture::query()
            ->select('type', DB::raw('count(*) as total'))
            ->groupBy('type')
            ->pluck('total', 'type');

        $byStation = Capture::query()
            ->select('station', DB::raw('count(*) as total'), DB::raw('max(created_at) as last_capture_at'))
            ->groupBy('station')
            ->orderByDesc('total')
            ->get()
            ->map(fn (Capture $row): array => [
                'station' => $row->station ?? 'Unnamed booth',
                'total' => (int) $row->getAttribute('total'),
                'last_capture_at' => $row->getAttribute('last_capture_at'),
            ])
            ->keyBy('station');

        // Merge what each booth device last reported about its upload queue.
        foreach ($monitor->all() as $station => $report) {
            $byStation[$station] = [
                ...($byStation[$station] ?? ['station' => $station, 'total' => 0, 'last_capture_at' => null]),
                'waiting' => $report['waiting'],
                'failed' => $report['failed'],
                'last_seen' => $report['last_seen'],
            ];
        }

        return response()->json([
            'data' => [
                'captures' => [
                    'total' => (int) $byType->sum(),
                    'collage' => (int) ($byType['collage'] ?? 0),
                    'boomerang' => (int) ($byType['boomerang'] ?? 0),
                    'today' => Capture::query()->where('created_at', '>=', now()->startOfDay())->count(),
                    'hidden' => Capture::query()->where('is_hidden', true)->count(),
                    'with_wish' => Capture::query()->whereNotNull('message')->count(),
                ],
                'albums' => Album::query()->count(),
                'downloads' => (int) Capture::query()->sum('downloads'),
                'pending_derivatives' => Capture::query()->whereNull('thumb_path')->count(),
                'drive_backup' => [
                    'enabled' => (bool) config('services.google_drive.backup_enabled'),
                    'complete' => Capture::query()->where('drive_backup_status', Capture::DRIVE_BACKUP_COMPLETE)->count(),
                    'pending' => Capture::query()->whereIn('drive_backup_status', [
                        Capture::DRIVE_BACKUP_PENDING,
                        Capture::DRIVE_BACKUP_PROCESSING,
                    ])->count(),
                    'failed' => Capture::query()->where('drive_backup_status', Capture::DRIVE_BACKUP_FAILED)->count(),
                    'not_queued' => Capture::query()->whereNull('drive_backup_status')->count(),
                ],
                'stations' => $byStation->values(),
            ],
        ]);
    }
}
