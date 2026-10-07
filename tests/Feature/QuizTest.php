<?php

use App\Models\QuizAttempt;
use App\Models\QuizQuestion;
use App\Services\Settings;
use Illuminate\Support\Str;

function quizQuestions(): array
{
    return [
        QuizQuestion::query()->create(['question' => 'Where did they first meet?', 'choices' => ['Church', 'College', 'A wedding'], 'answer_index' => 1, 'sort' => 1]),
        QuizQuestion::query()->create(['question' => 'Who said I love you first?', 'choices' => ['Edwin', 'Jochel'], 'answer_index' => 0, 'sort' => 2]),
    ];
}

it('serves the questions without their answers', function () {
    quizQuestions();

    $response = $this->getJson('/api/quiz');

    $response->assertOk()->assertJsonCount(2, 'data')->assertJsonMissingPath('data.0.answer_index');
});

it('scores an attempt and gives a verdict', function () {
    [$first, $second] = quizQuestions();

    $response = $this->postJson('/api/quiz/attempts', [
        'device_id' => (string) Str::uuid(),
        'name' => 'Tita Baby',
        'answers' => [$first->id => 1, $second->id => 1],
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.score', 1)
        ->assertJsonPath('data.total', 2)
        ->assertJsonPath('data.verdict', 'A true friend of the couple.');
    $this->assertDatabaseHas('quiz_attempts', ['name' => 'Tita Baby', 'score' => 1]);
});

it('allows one attempt per device', function () {
    [$first] = quizQuestions();
    $device = (string) Str::uuid();
    $this->postJson('/api/quiz/attempts', ['device_id' => $device, 'name' => 'Kuya Jun', 'answers' => [$first->id => 1]])->assertCreated();

    $again = $this->postJson('/api/quiz/attempts', ['device_id' => $device, 'name' => 'Kuya Jun again', 'answers' => [$first->id => 1]]);

    $again->assertConflict()->assertJsonPath('message', 'You have already played on this phone. One try each!');
    expect(QuizAttempt::query()->count())->toBe(1);
});

it('requires a name for the leaderboard', function () {
    $this->postJson('/api/quiz/attempts', ['device_id' => (string) Str::uuid(), 'answers' => [1 => 0]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name' => 'Please add your name for the leaderboard.']);
});

it('ranks the leaderboard by score, earliest first among ties', function () {
    $this->travel(-1)->hours();
    QuizAttempt::query()->create(['device_id' => (string) Str::uuid(), 'name' => 'Early ten', 'score' => 10, 'answers' => []]);
    $this->travelBack();
    QuizAttempt::query()->create(['device_id' => (string) Str::uuid(), 'name' => 'Late ten', 'score' => 10, 'answers' => []]);
    QuizAttempt::query()->create(['device_id' => (string) Str::uuid(), 'name' => 'Five', 'score' => 5, 'answers' => []]);

    $this->getJson('/api/quiz/leaderboard')
        ->assertJsonPath('data.0.name', 'Early ten')
        ->assertJsonPath('data.1.name', 'Late ten')
        ->assertJsonPath('data.2.name', 'Five');
});

it('lets staff write questions with the right answer', function () {
    $headers = adminHeaders();

    $this->postJson('/api/admin/quiz/questions', ['question' => 'Favourite food?', 'choices' => ['Adobo', 'Sinigang'], 'answer_index' => 1], $headers)
        ->assertCreated()
        ->assertJsonPath('data.answer_index', 1);

    $this->postJson('/api/admin/quiz/questions', ['question' => 'Bad', 'choices' => ['One', 'Two'], 'answer_index' => 2], $headers)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['answer_index' => 'Choose which answer is right.']);
});

it('reveals the winner on the slideshow', function () {
    $this->postJson('/api/admin/quiz/reveal', [], adminHeaders())->assertNoContent();

    expect(app(Settings::class)->get('quiz_revealed_at'))->not->toBeNull();
});
