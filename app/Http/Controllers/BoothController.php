<?php

namespace App\Http\Controllers;

use App\Http\Resources\LayoutResource;
use App\Models\Layout;
use App\Services\Settings;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class BoothController extends Controller
{
    /**
     * The guest booth flow: mode, frame, look, camera. Only frames switched on
     * in admin are offered.
     */
    public function __invoke(Settings $settings): Response|RedirectResponse
    {
        if ($settings->get('after_wedding_mode')) {
            return redirect()->route('home');
        }

        return Inertia::render('booth', [
            'layouts' => LayoutResource::collection(
                Layout::query()->active()->orderBy('sort_order')->get()
            )->resolve(),
        ]);
    }
}
