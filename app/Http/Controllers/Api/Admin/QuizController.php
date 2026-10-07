<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuizAttempt;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class QuizController extends Controller
{
    public function attempts(): JsonResponse
    {
        return response()->json([
            'data' => QuizAttempt::query()->orderByDesc('score')->orderBy('created_at')->limit(50)->get(['name', 'score', 'created_at']),
        ]);
    }

    /**
     * Puts the winner on the projector slideshow.
     */
    public function reveal(Settings $settings): Response
    {
        $settings->set('quiz_revealed_at', now()->toIso8601String());

        return response()->noContent();
    }

    /**
     * Clears every attempt (after a rehearsal).
     */
    public function reset(Settings $settings): Response
    {
        QuizAttempt::query()->delete();
        $settings->set('quiz_revealed_at', null);

        return response()->noContent();
    }
}
