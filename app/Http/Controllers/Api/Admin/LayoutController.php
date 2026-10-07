<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\LayoutResource;
use App\Models\Layout;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LayoutController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return LayoutResource::collection(Layout::query()->orderBy('sort_order')->get());
    }

    public function update(Request $request, Layout $layout): LayoutResource
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $layout->update($validated);

        return LayoutResource::make($layout);
    }
}
