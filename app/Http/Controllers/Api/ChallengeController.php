<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Challenge;
use Illuminate\Http\JsonResponse;

class ChallengeController extends Controller
{
    /**
     * The active photo challenges, with how many photos each already has.
     */
    public function index(): JsonResponse
    {
        $challenges = Challenge::query()
            ->where('is_active', true)
            ->withCount(['captures' => fn ($query) => $query->where('is_hidden', false)])
            ->orderBy('sort')
            ->get(['id', 'title', 'sort']);

        return response()->json([
            'data' => $challenges->map(fn (Challenge $challenge): array => [
                'id' => $challenge->id,
                'title' => $challenge->title,
                'photos' => $challenge->captures_count,
            ]),
        ]);
    }
}
