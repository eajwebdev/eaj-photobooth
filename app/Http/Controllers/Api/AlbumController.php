<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAlbumRequest;
use App\Http\Resources\AlbumResource;
use App\Models\Album;
use App\Services\AlbumRegistry;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class AlbumController extends Controller
{
    public function store(StoreAlbumRequest $request, AlbumRegistry $albums): JsonResponse
    {
        ['album' => $album, 'created' => $created] = $albums->findOrCreate(
            (string) $request->validated('client_uuid'),
            $request->validated('guest_name'),
            $request->validated('station'),
        );

        return AlbumResource::make($album)
            ->response()
            ->setStatusCode($created ? Response::HTTP_CREATED : Response::HTTP_OK);
    }

    public function show(Album $album): AlbumResource
    {
        $album->load([
            'captures' => fn (HasMany $query) => $query->visible()->with('layout:id,slug')->orderBy('id'),
        ]);
        $album->captures_count = $album->captures->count();

        return AlbumResource::make($album);
    }
}
