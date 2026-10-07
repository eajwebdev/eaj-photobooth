<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Layout;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;

class SettingsController extends Controller
{
    public function show(Settings $settings): JsonResponse
    {
        return response()->json([
            'data' => [
                ...$settings->public(),
                'frames' => Layout::query()->active()->orderBy('sort_order')->pluck('slug'),
            ],
        ]);
    }
}
