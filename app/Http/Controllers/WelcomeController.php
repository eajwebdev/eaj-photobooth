<?php

namespace App\Http\Controllers;

use App\Enums\CaptureType;
use App\Models\Capture;
use App\Services\Settings;
use Inertia\Inertia;
use Inertia\Response;

class WelcomeController extends Controller
{
    private const ATTRACT_COLLAGES = 12;

    /**
     * The booth's welcome screen. `recent` feeds the idle attract mode with the
     * newest collages (it is reloaded on its own each time the screen idles).
     */
    public function __invoke(Settings $settings): Response
    {
        // After the wedding the booth is closed: guests land on the couple's thank-you page.
        if ($settings->get('after_wedding_mode')) {
            return Inertia::render('thank-you');
        }

        return Inertia::render('welcome', [
            'recent' => fn (): array => Capture::query()
                ->visible()
                ->where('type', CaptureType::Collage)
                ->latest('id')
                ->limit(self::ATTRACT_COLLAGES)
                ->get(['uuid', 'media_path', 'preview_path', 'dominant_color'])
                ->map(fn (Capture $capture): array => [
                    'uuid' => $capture->uuid,
                    'image' => Capture::publicUrl($capture->preview_path ?? $capture->media_path),
                    'color' => $capture->dominant_color,
                ])
                ->all(),
        ]);
    }
}
