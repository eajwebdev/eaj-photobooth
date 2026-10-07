<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListCapturesRequest;
use App\Http\Requests\Admin\UpdateCaptureRequest;
use App\Http\Resources\CaptureResource;
use App\Models\Album;
use App\Models\Capture;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CaptureController extends Controller
{
    private const PER_PAGE = 48;

    public function index(ListCapturesRequest $request): AnonymousResourceCollection
    {
        $query = Capture::query()
            ->with(['album:id,code', 'layout:id,slug'])
            ->orderByDesc('id');

        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }

        if ($request->has('hidden')) {
            $query->where('is_hidden', $request->boolean('hidden'));
        }

        if ($request->filled('station')) {
            $query->where('station', $request->string('station')->toString());
        }

        if ($request->filled('album')) {
            $albumId = Album::query()->where('code', strtoupper($request->string('album')->toString()))->value('id');
            $query->where('album_id', $albumId ?? 0);
        }

        if ($request->filled('q')) {
            $query->where('guest_name', 'like', '%'.$request->string('q')->trim()->toString().'%');
        }

        return CaptureResource::collection($query->paginate(self::PER_PAGE)->withQueryString())
            ->additional(['stations' => Capture::query()->whereNotNull('station')->distinct()->orderBy('station')->pluck('station')]);
    }

    public function update(UpdateCaptureRequest $request, Capture $capture): CaptureResource
    {
        $capture->update($request->validated());

        return CaptureResource::make($capture->load(['album:id,code', 'layout:id,slug']));
    }

    public function destroy(Capture $capture): Response
    {
        $capture->deleteWithFiles();

        return response()->noContent();
    }
}
