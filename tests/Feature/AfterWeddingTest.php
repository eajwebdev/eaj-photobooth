<?php

use App\Models\Album;
use App\Services\Settings;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the thank-you page on the home screen after the wedding', function () {
    app(Settings::class)->set('after_wedding_mode', true);

    $this->get('/')->assertInertia(fn (Assert $page) => $page->component('thank-you'));
});

it('closes the booth after the wedding', function () {
    app(Settings::class)->set('after_wedding_mode', true);

    $this->get('/booth')->assertRedirect('/');
});

it('keeps the gallery and albums open after the wedding', function () {
    app(Settings::class)->set('after_wedding_mode', true);
    Album::factory()->create(['code' => 'ROSE-4821']);

    $this->get('/gallery')->assertInertia(fn (Assert $page) => $page->component('gallery'));
    $this->get('/a/ROSE-4821')->assertInertia(fn (Assert $page) => $page->component('album')->where('album.code', 'ROSE-4821'));
});

it('opens the projector slideshow from the gallery address', function () {
    $this->get('/gallery?slideshow=1')->assertInertia(fn (Assert $page) => $page->component('gallery')->where('slideshow', true));
});
