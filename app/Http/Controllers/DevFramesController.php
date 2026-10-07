<?php

namespace App\Http\Controllers;

use App\Http\Resources\LayoutResource;
use App\Models\Layout;
use Inertia\Inertia;
use Inertia\Response;

class DevFramesController extends Controller
{
    /**
     * Local-only proof sheet: every frame in every look, composed in the
     * browser with generated sample photos.
     */
    public function __invoke(): Response
    {
        return Inertia::render('dev/frames', [
            'layouts' => LayoutResource::collection(Layout::query()->orderBy('sort_order')->get())->resolve(),
        ]);
    }
}
