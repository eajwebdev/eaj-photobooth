<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\BuildMosaic;
use App\Models\Capture;
use App\Models\Mosaic;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class MosaicController extends Controller
{
    public function show(Settings $settings): JsonResponse
    {
        return $this->present(Mosaic::query()->latest('id')->first(), $settings);
    }

    /**
     * Upload the couple's photo and build the mosaic from every guest collage.
     */
    public function store(Request $request, Settings $settings): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:25600'],
        ]);

        $path = $request->file('photo')->storeAs('mosaics', 'source-'.Str::uuid().'.'.$request->file('photo')->extension(), 'local');
        $mosaic = Mosaic::query()->create(['source_path' => $path, 'status' => Mosaic::STATUS_PENDING]);

        BuildMosaic::dispatch($mosaic);

        return $this->present($mosaic->refresh(), $settings, Response::HTTP_ACCEPTED);
    }

    /**
     * Rebuild from the same photo, with every collage taken since.
     */
    public function rebuild(Settings $settings): JsonResponse
    {
        $mosaic = Mosaic::query()->latest('id')->firstOrFail();
        $mosaic->update(['status' => Mosaic::STATUS_PENDING, 'error' => null]);

        BuildMosaic::dispatch($mosaic);

        return $this->present($mosaic->refresh(), $settings, Response::HTTP_ACCEPTED);
    }

    /**
     * Shows the reveal on the slideshow and makes it downloadable in the gallery.
     */
    public function reveal(Settings $settings): JsonResponse
    {
        $mosaic = Mosaic::query()->latest('id')->firstOrFail();
        abort_unless($mosaic->status === Mosaic::STATUS_READY, Response::HTTP_UNPROCESSABLE_ENTITY, 'The mosaic is not ready yet.');

        $settings->set('mosaic_revealed_at', now()->toIso8601String());

        return $this->present($mosaic, $settings);
    }

    public function hide(Settings $settings): JsonResponse
    {
        $settings->set('mosaic_revealed_at', null);

        return $this->present(Mosaic::query()->latest('id')->first(), $settings);
    }

    private function present(?Mosaic $mosaic, Settings $settings, int $status = Response::HTTP_OK): JsonResponse
    {
        return response()->json([
            'data' => $mosaic === null ? null : [
                'status' => $mosaic->status,
                'error' => $mosaic->error,
                'tiles' => $mosaic->tiles,
                'built_at' => $mosaic->built_at?->toIso8601String(),
                'preview' => Capture::publicUrl($mosaic->preview_path),
                'download' => Capture::publicUrl($mosaic->output_path),
                'revealed_at' => $settings->get('mosaic_revealed_at'),
            ],
        ], $status);
    }
}
