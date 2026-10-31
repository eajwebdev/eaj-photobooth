<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Album;
use App\Models\Capture;
use App\Services\GoogleDriveBackup;
use App\Services\StationMonitor;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    private const STUCK_AFTER_MINUTES = 10;

    private const RECENT_DRIVE_ERRORS = 5;

    public function __invoke(StationMonitor $monitor, GoogleDriveBackup $drive): JsonResponse
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
                    'enabled' => $drive->enabled(),
                    'configured' => $drive->configured(),
                    'complete' => Capture::query()->where('drive_backup_status', Capture::DRIVE_BACKUP_COMPLETE)->count(),
                    'pending' => Capture::query()->whereIn('drive_backup_status', [
                        Capture::DRIVE_BACKUP_PENDING,
                        Capture::DRIVE_BACKUP_PROCESSING,
                    ])->count(),
                    'failed' => Capture::query()->where('drive_backup_status', Capture::DRIVE_BACKUP_FAILED)->count(),
                    'not_queued' => Capture::query()->whereNull('drive_backup_status')->count(),
                    // Queued long ago and never attempted: the backups worker is not running.
                    'stuck' => Capture::query()
                        ->where('drive_backup_status', Capture::DRIVE_BACKUP_PENDING)
                        ->whereNull('drive_backup_error')
                        ->where('updated_at', '<', now()->subMinutes(self::STUCK_AFTER_MINUTES))
                        ->count(),
                    'errors' => Capture::query()
                        ->whereNotNull('drive_backup_error')
                        ->latest('updated_at')
                        ->limit(self::RECENT_DRIVE_ERRORS)
                        ->get(['id', 'guest_name', 'drive_backup_status', 'drive_backup_error', 'updated_at'])
                        ->map(fn (Capture $capture): array => [
                            'capture_id' => $capture->id,
                            'guest_name' => $capture->guest_name,
                            'status' => $capture->drive_backup_status,
                            'error' => $capture->drive_backup_error,
                            'at' => $capture->updated_at?->toIso8601String(),
                        ]),
                ],
                'stations' => $byStation->values(),
            ],
        ]);
    }
}
