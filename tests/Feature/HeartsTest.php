<?php

use App\Models\Capture;
use Illuminate\Support\Str;

it('counts one heart per device per photo', function () {
    $capture = Capture::factory()->create();
    $device = (string) Str::uuid();

    $this->postJson("/api/captures/{$capture->uuid}/heart", ['device_id' => $device])->assertOk()->assertJsonPath('data.hearts_count', 1);
    $this->postJson("/api/captures/{$capture->uuid}/heart", ['device_id' => $device])->assertOk()->assertJsonPath('data.hearts_count', 1);
    $this->postJson("/api/captures/{$capture->uuid}/heart", ['device_id' => (string) Str::uuid()])->assertJsonPath('data.hearts_count', 2);

    $this->assertDatabaseCount('hearts', 2);
});

it('takes a heart back', function () {
    $capture = Capture::factory()->create();
    $device = (string) Str::uuid();
    $this->postJson("/api/captures/{$capture->uuid}/heart", ['device_id' => $device]);

    $response = $this->deleteJson("/api/captures/{$capture->uuid}/heart", ['device_id' => $device]);

    $response->assertOk()->assertJsonPath('data.hearts_count', 0)->assertJsonPath('data.hearted', false);
    $this->assertDatabaseCount('hearts', 0);
});

it('returns 404 when hearting a hidden photo', function () {
    $capture = Capture::factory()->hidden()->create();

    $this->postJson("/api/captures/{$capture->uuid}/heart", ['device_id' => (string) Str::uuid()])->assertNotFound();
});

it('requires a device id', function () {
    $capture = Capture::factory()->create();

    $this->postJson("/api/captures/{$capture->uuid}/heart", [])->assertUnprocessable()->assertJsonValidationErrors(['device_id']);
});

it('returns 429 when one phone hearts too fast', function () {
    $captures = Capture::factory()->count(41)->create();
    $device = (string) Str::uuid();

    foreach ($captures->take(40) as $capture) {
        $this->postJson("/api/captures/{$capture->uuid}/heart", ['device_id' => $device])->assertOk();
    }

    $this->postJson("/api/captures/{$captures->last()->uuid}/heart", ['device_id' => $device])->assertTooManyRequests();
});

it('sorts the gallery by most loved', function () {
    Capture::factory()->create(['hearts_count' => 1]);
    $loved = Capture::factory()->create(['hearts_count' => 9]);
    Capture::factory()->create(['hearts_count' => 0]);

    $this->getJson('/api/gallery?sort=loved')->assertJsonPath('data.0.uuid', $loved->uuid);
});
