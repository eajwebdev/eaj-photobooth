<?php

namespace App\Http\Controllers\Api\Keepsake;

use App\Http\Controllers\Controller;
use App\Http\Resources\GuestbookEntryResource;
use App\Models\Capture;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GuestbookController extends Controller
{
    /**
     * Every visible capture that carries a name, a wish or a signature, in the
     * order the guests signed.
     */
    public function index(): AnonymousResourceCollection
    {
        return GuestbookEntryResource::collection(
            Capture::query()->visible()->guestbookEntries()->orderBy('id')->get()
        )->additional([
            'stats' => [
                'photos' => Capture::query()->visible()->count(),
                'wishes' => Capture::query()->visible()->whereNotNull('message')->count(),
                'signatures' => Capture::query()->visible()->whereNotNull('signature_path')->count(),
            ],
        ]);
    }
}
