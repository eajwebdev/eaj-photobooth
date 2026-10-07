<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateSettingsRequest;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;

class SettingsController extends Controller
{
    public function show(Settings $settings): JsonResponse
    {
        return $this->respond($settings);
    }

    public function update(UpdateSettingsRequest $request, Settings $settings): JsonResponse
    {
        $settings->setMany(Arr::only($request->validated(), UpdateSettingsRequest::SETTING_KEYS));

        foreach (['admin', 'keepsake'] as $kind) {
            if ($request->filled("{$kind}_pin")) {
                $settings->setPin($kind, (string) $request->validated("{$kind}_pin"));
            }
        }

        return $this->respond($settings);
    }

    private function respond(Settings $settings): JsonResponse
    {
        return response()->json([
            'data' => [
                ...Arr::except($settings->all(), ['admin_pin_hash', 'keepsake_pin_hash']),
                'has_keepsake_pin' => $settings->get('keepsake_pin_hash') !== null,
            ],
        ]);
    }
}
