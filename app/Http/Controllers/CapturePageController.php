<?php

namespace App\Http\Controllers;

use App\Http\Resources\CaptureResource;
use App\Models\Capture;
use Inertia\Inertia;
use Inertia\Response;

class CapturePageController extends Controller
{
    /**
     * The share page for one photo or boomerang: /p/{uuid}.
     */
    public function __invoke(string $uuid): Response
    {
        $capture = Capture::query()
            ->visible()
            ->where('uuid', $uuid)
            ->with(['album:id,code', 'layout:id,slug'])
            ->firstOrFail();

        return Inertia::render('capture', [
            'capture' => CaptureResource::make($capture)->resolve(),
        ]);
    }
}
