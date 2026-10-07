<?php

namespace App\Http\Controllers\Api;

use App\Enums\GuestGroup;
use App\Http\Controllers\Controller;
use App\Http\Resources\CaptureResource;
use App\Models\Capture;
use App\Models\Mosaic;
use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class PartyStateController extends Controller
{
    /**
     * Everything the slideshow and gallery need for the party modules in one
     * call: table and group tallies, most-loved photos, the quiz leaderboard,
     * the winner reveal and the mosaic (once revealed).
     */
    public function __invoke(Settings $settings): JsonResponse
    {
        $modules = (array) $settings->get('modules', []);
        $mosaic = Mosaic::query()->where('status', Mosaic::STATUS_READY)->latest('id')->first();
        $revealedAt = $settings->get('mosaic_revealed_at');

        return response()->json([
            'data' => [
                'tallies' => ($modules['who_are_you'] ?? false) ? $this->tallies() : null,
                'most_loved' => ($modules['hearts'] ?? false)
                    ? CaptureResource::collection(
                        Capture::query()->visible()->where('hearts_count', '>', 0)->with(['album:id,code'])->orderByDesc('hearts_count')->orderByDesc('id')->limit(6)->get()
                    )->resolve()
                    : [],
                'leaderboard' => ($modules['quiz'] ?? false)
                    ? [
                        'total' => QuizQuestion::query()->count(),
                        'top' => QuizAttempt::query()->orderByDesc('score')->orderBy('created_at')->limit(10)->get(['name', 'score']),
                    ]
                    : null,
                'quiz_revealed_at' => $settings->get('quiz_revealed_at'),
                'mosaic' => ($modules['mosaic'] ?? false) && $mosaic !== null && $revealedAt !== null
                    ? [
                        'preview' => Capture::publicUrl($mosaic->preview_path),
                        'download' => Capture::publicUrl($mosaic->output_path),
                        'revealed_at' => $revealedAt,
                    ]
                    : null,
            ],
        ]);
    }

    /**
     * @return array{tables: list<array{table: int, photos: int}>, groups: list<array{group: string, label: string, photos: int}>}
     */
    private function tallies(): array
    {
        $tables = Capture::query()->visible()->whereNotNull('table_no')
            ->select('table_no', DB::raw('count(*) as photos'))
            ->groupBy('table_no')->orderByDesc('photos')->limit(5)->get()
            ->map(fn (Capture $row): array => ['table' => (int) $row->table_no, 'photos' => (int) $row->getAttribute('photos')])
            ->all();

        $groups = Capture::query()->visible()->whereNotNull('group_tag')
            ->select('group_tag', DB::raw('count(*) as photos'))
            ->groupBy('group_tag')->orderByDesc('photos')->get()
            ->map(fn (Capture $row): array => [
                'group' => (string) $row->group_tag,
                'label' => GuestGroup::labelFor($row->group_tag) ?? (string) $row->group_tag,
                'photos' => (int) $row->getAttribute('photos'),
            ])
            ->all();

        return ['tables' => $tables, 'groups' => $groups];
    }
}
