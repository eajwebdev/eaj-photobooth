<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Challenge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ChallengeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Challenge::query()->withCount('captures')->orderBy('sort')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
        ]);

        $challenge = Challenge::query()->create([
            'title' => $validated['title'],
            'sort' => (int) Challenge::query()->max('sort') + 1,
            'is_active' => true,
        ]);

        return response()->json(['data' => $challenge], Response::HTTP_CREATED);
    }

    public function update(Request $request, Challenge $challenge): JsonResponse
    {
        $challenge->update($request->validate([
            'title' => ['sometimes', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'sort' => ['sometimes', 'integer', 'min:0', 'max:1000'],
        ]));

        return response()->json(['data' => $challenge]);
    }

    /**
     * Photos taken for it keep their pictures; they just lose the tag.
     */
    public function destroy(Challenge $challenge): Response
    {
        $challenge->delete();

        return response()->noContent();
    }
}
