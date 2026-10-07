<?php

use App\Models\Capture;
use App\Models\Export;
use App\Services\Settings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function keepsakeHeaders(string $pin = '1225'): array
{
    app(Settings::class)->setPin('keepsake', $pin);

    return ['X-Keepsake-Pin' => $pin];
}

it('returns 401 for the keepsake without the couple PIN', function () {
    keepsakeHeaders();

    $this->getJson('/api/keepsake/guestbook')->assertUnauthorized();
});

it('does not accept the admin PIN for the keepsake', function () {
    keepsakeHeaders('1225');

    $this->getJson('/api/keepsake/guestbook', adminHeaders('2468') + ['X-Keepsake-Pin' => '2468'])->assertUnauthorized();
});

it('lists guestbook entries in signing order with their signatures', function () {
    $first = Capture::factory()->create(['guest_name' => 'Lola Remedios', 'message' => 'God bless you both', 'signature_path' => 'signatures/a.png']);
    Capture::factory()->create(['guest_name' => null, 'message' => null]);
    Capture::factory()->hidden()->create(['message' => 'Hidden wish']);
    $last = Capture::factory()->create(['guest_name' => 'Kuya Jun']);

    $response = $this->getJson('/api/keepsake/guestbook', keepsakeHeaders());

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.uuid', $first->uuid)
        ->assertJsonPath('data.0.signature', '/storage/signatures/a.png')
        ->assertJsonPath('data.1.uuid', $last->uuid)
        ->assertJsonPath('stats.photos', 3)
        ->assertJsonPath('stats.wishes', 1);
});

it('lists every visible capture with the couple favourites first', function () {
    Capture::factory()->create();
    $favourite = Capture::factory()->create(['is_couple_favourite' => true]);
    Capture::factory()->hidden()->create();

    $response = $this->getJson('/api/keepsake/captures', keepsakeHeaders());

    $response->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.uuid', $favourite->uuid);
});

it('builds the guestbook PDF with a page per entry, downloadable through a signed link', function () {
    Storage::fake('public');
    Storage::fake('local');
    $capture = Capture::factory()->create([
        'guest_name' => 'Tita Baby',
        'message' => 'Mabuhay ang bagong kasal!',
        'preview_path' => 'previews/a.jpg',
        'signature_path' => 'signatures/a.png',
    ]);
    Storage::disk('public')->put('previews/a.jpg', UploadedFile::fake()->image('a.jpg', 400, 600)->getContent());
    Storage::disk('public')->put('signatures/a.png', UploadedFile::fake()->image('s.png', 300, 100)->getContent());
    $headers = keepsakeHeaders();

    $created = $this->postJson('/api/keepsake/exports', ['kind' => 'guestbook'], $headers);
    $status = $this->getJson('/api/keepsake/exports/'.$created->json('data.uuid'), $headers);

    $status->assertJsonPath('data.status', Export::STATUS_READY)->assertJsonPath('data.kind', 'guestbook');
    $pdf = Storage::disk('local')->get(Export::query()->sole()->path);
    expect($pdf)->toStartWith('%PDF')
        ->and(substr_count($pdf, '/Type /Page'))->toBeGreaterThanOrEqual(3);
    $this->get($status->json('data.download_url'))->assertDownload();
    expect($capture->refresh()->guest_name)->toBe('Tita Baby');
});

it('rejects an unknown export kind', function () {
    $this->postJson('/api/keepsake/exports', ['kind' => 'everything'], keepsakeHeaders())
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['kind']);
});
