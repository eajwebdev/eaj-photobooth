<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use App\Services\QuizScorer;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class QuizController extends Controller
{
    /**
     * "How well do you know the couple?" The questions, never the answers.
     */
    public function questions(): JsonResponse
    {
        return response()->json([
            'data' => QuizQuestion::query()->orderBy('sort')->orderBy('id')->get(['id', 'question', 'choices']),
        ]);
    }

    /**
     * One attempt per device. Returns the score, a verdict and the right answers.
     */
    public function attempt(Request $request, QuizScorer $scorer): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:80'],
            'answers' => ['required', 'array'],
            'answers.*' => ['integer', 'min:0', 'max:9'],
        ], [
            'name.required' => 'Please add your name for the leaderboard.',
        ]);

        if (QuizAttempt::query()->where('device_id', $validated['device_id'])->exists()) {
            return response()->json(['message' => 'You have already played on this phone. One try each!'], Response::HTTP_CONFLICT);
        }

        $questions = QuizQuestion::query()->orderBy('sort')->orderBy('id')->get();
        $result = $scorer->score($questions, $validated['answers']);

        try {
            QuizAttempt::query()->create([
                'device_id' => $validated['device_id'],
                'name' => trim($validated['name']),
                'score' => $result['score'],
                'answers' => $validated['answers'],
            ]);
        } catch (UniqueConstraintViolationException) {
            return response()->json(['message' => 'You have already played on this phone. One try each!'], Response::HTTP_CONFLICT);
        }

        return response()->json([
            'data' => [...$result, 'verdict' => $scorer->verdict($result['score'], $result['total'])],
        ], Response::HTTP_CREATED);
    }

    /**
     * The device's earlier attempt, so the score shows again on return.
     */
    public function mine(string $deviceId, QuizScorer $scorer): JsonResponse
    {
        $attempt = QuizAttempt::query()->where('device_id', $deviceId)->firstOrFail();
        $total = QuizQuestion::query()->count();

        return response()->json([
            'data' => ['name' => $attempt->name, 'score' => $attempt->score, 'total' => $total, 'verdict' => $scorer->verdict($attempt->score, $total)],
        ]);
    }

    public function leaderboard(): JsonResponse
    {
        return response()->json([
            'data' => QuizAttempt::query()->orderByDesc('score')->orderBy('created_at')->limit(10)->get(['name', 'score', 'created_at']),
            'total' => QuizQuestion::query()->count(),
        ]);
    }
}
