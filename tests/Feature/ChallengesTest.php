<?php

use App\Models\Album;
use App\Models\Capture;
use App\Models\Challenge;
use Database\Seeders\LayoutSeeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

it('lists active challenges with their photo counts', function () {
    $active = Challenge::query()->create(['title' => 'With someone you just met', 'sort' => 1]);
    Challenge::query()->create(['title' => 'Retired', 'sort' => 2, 'is_active' => false]);
    Capture::factory()->count(2)->create(['challenge_id' => $active->id]);

    $response = $this->getJson('/api/challenges');

    $response->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.photos', 2);
});

it('tags a capture with the challenge it was taken for', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);
    $challenge = Challenge::query()->create(['title' => 'The most dramatic dip', 'sort' => 1]);

    $response = $this->post('/api/captures', collagePayload(['challenge_id' => $challenge->id]), ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonPath('data.challenge_id', $challenge->id);
    $this->getJson('/api/gallery?challenge='.$challenge->id)->assertJsonCount(1, 'data');
});

it('shows how many challenges an album has completed', function () {
    $album = Album::factory()->create(['code' => 'RING-2345']);
    [$first, $second] = [Challenge::query()->create(['title' => 'A', 'sort' => 1]), Challenge::query()->create(['title' => 'B', 'sort' => 2])];
    Challenge::query()->create(['title' => 'C', 'sort' => 3]);
    Capture::factory()->for($album)->count(2)->create(['challenge_id' => $first->id]);
    Capture::factory()->for($album)->create(['challenge_id' => $second->id]);

    $this->getJson('/api/albums/RING-2345')->assertJsonPath('data.challenges', ['done' => 2, 'total' => 3]);
});

it('lets staff add, rename, switch off and delete challenges', function () {
    $headers = adminHeaders();

    $created = $this->postJson('/api/admin/challenges', ['title' => 'Your best kilig face'], $headers)->assertCreated();
    $id = $created->json('data.id');
    $this->patchJson("/api/admin/challenges/{$id}", ['title' => 'Your best kilig face!', 'is_active' => false], $headers)->assertOk();

    expect(Challenge::query()->find($id))->title->toBe('Your best kilig face!')->is_active->toBeFalse();

    $this->deleteJson("/api/admin/challenges/{$id}", [], $headers)->assertNoContent();
    $this->assertDatabaseMissing('challenges', ['id' => $id]);
});

it('returns 401 for challenge editing without the admin PIN', function () {
    adminHeaders();

    $this->postJson('/api/admin/challenges', ['title' => 'Sneaky'])->assertUnauthorized();
    expect(Challenge::query()->count())->toBe(0);
});

it('rejects an unknown guest group', function () {
    Storage::fake('public');
    $this->seed(LayoutSeeder::class);

    $this->post('/api/captures', collagePayload(['group_tag' => 'paparazzi', 'client_uuid' => (string) Str::uuid()]), ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['group_tag']);
});
