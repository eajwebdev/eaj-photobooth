<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LayoutResource;
use App\Models\Layout;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LayoutController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return LayoutResource::collection(
            Layout::query()->active()->orderBy('sort_order')->get()
        );
    }
}
