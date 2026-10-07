<?php

namespace App\Services;

use App\Models\QuizQuestion;
use Illuminate\Support\Collection;

/**
 * Marks a guest's quiz answers and picks a friendly verdict.
 */
class QuizScorer
{
    /**
     * @param  Collection<int, QuizQuestion>  $questions
     * @param  array<int|string, int>  $answers  question id => chosen index
     * @return array{score: int, total: int, results: list<array{question_id: int, chosen: int|null, correct: int}>}
     */
    public function score(Collection $questions, array $answers): array
    {
        $results = $questions->map(fn (QuizQuestion $question): array => [
            'question_id' => $question->id,
            'chosen' => isset($answers[$question->id]) ? (int) $answers[$question->id] : null,
            'correct' => $question->answer_index,
        ])->values()->all();

        return [
            'score' => count(array_filter($results, fn (array $result): bool => $result['chosen'] === $result['correct'])),
            'total' => count($results),
            'results' => $results,
        ];
    }

    public function verdict(int $score, int $total): string
    {
        $ratio = $total === 0 ? 0 : $score / $total;

        return match (true) {
            $ratio >= 1 => 'Perfect! You must be in the wedding party.',
            $ratio >= 0.8 => 'Practically family. The couple would be proud.',
            $ratio >= 0.5 => 'A true friend of the couple.',
            $ratio >= 0.2 => 'Time to catch up with them over dinner!',
            default => 'Clearly here for the food, and that is fine. Welcome!',
        };
    }
}
