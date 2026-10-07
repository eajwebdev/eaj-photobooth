<?php

namespace App\Http\Controllers;

use App\Http\Resources\AlbumResource;
use App\Models\Album;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Inertia\Inertia;
use Inertia\Response;

class AlbumPageController extends Controller
{
    /**
     * A guest's own album from the booth QR: /a/{code}. An unknown code still
     * gets a friendly page, since a booth that was offline may not have synced yet.
     */
    public function __invoke(string $code): Response
    {
        $album = Album::query()
            ->where('code', strtoupper(trim($code)))
            ->with(['captures' => fn (HasMany $query) => $query->visible()->with('layout:id,slug')->orderBy('id')])
            ->first();

        if ($album !== null) {
            $album->captures_count = $album->captures->count();
        }

        return Inertia::render('album', [
            'code' => strtoupper(trim($code)),
            'album' => $album === null ? null : AlbumResource::make($album)->resolve(),
        ]);
    }
}
