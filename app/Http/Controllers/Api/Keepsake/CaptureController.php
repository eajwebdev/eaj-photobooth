<?php

namespace App\Http\Controllers\Api\Keepsake;

use App\Http\Controllers\Controller;
use App\Http\Resources\CaptureResource;
use App\Models\Capture;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CaptureController extends Controller
{
    /**
     * Every photo and boomerang for the couple, the couple's favourites first.
     */
    public function index(): AnonymousResourceCollection
    {
        return CaptureResource::collection(
            Capture::query()
                ->visible()
                ->with(['album:id,code', 'layout:id,slug'])
                ->orderByDesc('is_couple_favourite')
                ->orderByDesc('id')
                ->get()
        );
    }
}
