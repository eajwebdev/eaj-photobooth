<?php

use App\Models\Layout;
use Database\Seeders\LayoutSeeder;
use Inertia\Testing\AssertableInertia as Assert;

it('offers only the frames switched on, in their seeded order', function () {
    $this->seed(LayoutSeeder::class);
    Layout::query()->where('slug', 'classic-portrait')->update(['is_active' => false]);

    $response = $this->get('/booth');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('booth')
        ->has('layouts', 19)
        ->where('layouts.0.slug', 'photo-strip-3')
        ->where('layouts.0.shots', 3)
        ->where('layouts.0.canvas', ['w' => 600, 'h' => 1800]));
});

it('does not expose the frames proof sheet outside local development', function () {
    $this->get('/dev/frames')->assertNotFound();
});
