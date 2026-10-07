<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GalleryIndexRequest;
use App\Http\Resources\CaptureResource;
use App\Models\Album;
use App\Models\Capture;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GalleryController extends Controller
{
    private const DEFAULT_PER_PAGE = 30;

    private const MAX_NEW_ITEMS = 100;

    /**
     * Visible captures, newest first. Pass ?after={id} to get only what arrived
     * since the guest's newest item (live updates); otherwise cursor-paginated.
     */
    public function index(GalleryIndexRequest $request): AnonymousResourceCollection
    {
        $query = $this->filtered($request)->with(['album:id,code', 'layout:id,slug']);

        // "Most loved": by hearts, newest first among equals.
        if ($request->input('sort') === 'loved') {
            $query->orderByDesc('hearts_count');
        }

        $query->orderByDesc('id');

        $total = Capture::query()->visible()->count();

        if ($request->filled('after')) {
            return CaptureResource::collection(
                $query->where('id', '>', $request->integer('after'))->limit(self::MAX_NEW_ITEMS)->get()
            )->additional(['total' => $total]);
        }

        return CaptureResource::collection(
            $query->cursorPaginate($request->integer('per_page', self::DEFAULT_PER_PAGE))->withQueryString()
        )->additional(['total' => $total]);
    }

    /**
     * @return Builder<Capture>
     */
    private function filtered(GalleryIndexRequest $request): Builder
    {
        $query = Capture::query()->visible();

        if ($request->filled('type')) {
            $query->where('type', $request->string('type')->toString());
        }

        if ($request->filled('q')) {
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($request->string('q')->toString()));
            $query->where('guest_name', 'like', '%'.$term.'%');
        }

        if ($request->filled('group')) {
            $query->where('group_tag', $request->string('group')->toString());
        }

        if ($request->filled('challenge')) {
            $query->where('challenge_id', $request->integer('challenge'));
        }

        if ($request->filled('album')) {
            $albumId = Album::query()->where('code', strtoupper($request->string('album')->toString()))->value('id');
            $query->where('album_id', $albumId ?? 0);
        }

        return $query;
    }
}
