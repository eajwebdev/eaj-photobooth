<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\QuizQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class QuizQuestionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => QuizQuestion::query()->orderBy('sort')->orderBy('id')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $question = QuizQuestion::query()->create([
            ...$this->validated($request),
            'sort' => (int) QuizQuestion::query()->max('sort') + 1,
        ]);

        return response()->json(['data' => $question], Response::HTTP_CREATED);
    }

    public function update(Request $request, QuizQuestion $question): JsonResponse
    {
        $question->update($this->validated($request));

        return response()->json(['data' => $question]);
    }

    public function destroy(QuizQuestion $question): Response
    {
        $question->delete();

        return response()->noContent();
    }

    /**
     * @return array{question: string, choices: list<string>, answer_index: int}
     */
    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'question' => ['required', 'string', 'max:200'],
            'choices' => ['required', 'array', 'min:2', 'max:4'],
            'choices.*' => ['required', 'string', 'max:80'],
            'answer_index' => ['required', 'integer', 'min:0', 'lt:'.count((array) $request->input('choices', []))],
        ], [
            'answer_index.lt' => 'Choose which answer is right.',
        ]);

        return [
            'question' => $validated['question'],
            'choices' => array_values($validated['choices']),
            'answer_index' => (int) $validated['answer_index'],
        ];
    }
}
