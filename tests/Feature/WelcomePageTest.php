<?php

use App\Models\Capture;
use Inertia\Testing\AssertableInertia as Assert;

it('renders the welcome screen with the couple settings shared', function () {
    $response = $this->get('/');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('welcome')
        ->where('photobooth.couple.groom', 'Edwin Abril Jr.')
        ->missing('photobooth.admin_pin_hash')
        ->missing('photobooth.gallery_code'));
});

it('feeds attract mode the 12 newest visible collages only', function () {
    Capture::factory()->count(13)->create();
    $newest = Capture::factory()->create(['preview_path' => 'previews/newest.jpg', 'dominant_color' => '#c9a14a']);
    Capture::factory()->hidden()->create();
    Capture::factory()->boomerang()->create();

    $response = $this->get('/');

    $response->assertInertia(fn (Assert $page) => $page
        ->has('recent', 12)
        ->where('recent.0', [
            'uuid' => $newest->uuid,
            'image' => '/storage/previews/newest.jpg',
            'color' => '#c9a14a',
        ]));
});
