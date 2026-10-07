<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capture;
use App\Models\Heart;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HeartController extends Controller
{
    /**
     * A guest hearts a photo: one heart per device per photo.
     */
    public function store(Request $request, Capture $capture): JsonResponse
    {
        abort_if($capture->is_hidden, Response::HTTP_NOT_FOUND);
        $deviceId = $request->validate(['device_id' => ['required', 'uuid']])['device_id'];

        try {
            Heart::query()->create(['capture_id' => $capture->id, 'device_id' => $deviceId]);
            $capture->increment('hearts_count');
        } catch (UniqueConstraintViolationException) {
            // Already hearted from this device: nothing changes.
        }

        return $this->respond($capture->refresh(), true);
    }

    /**
     * Takes the heart back.
     */
    public function destroy(Request $request, Capture $capture): JsonResponse
    {
        $deviceId = $request->validate(['device_id' => ['required', 'uuid']])['device_id'];

        $deleted = Heart::query()->where('capture_id', $capture->id)->where('device_id', $deviceId)->delete();

        if ($deleted > 0 && $capture->hearts_count > 0) {
            $capture->decrement('hearts_count');
        }

        return $this->respond($capture->refresh(), false);
    }

    private function respond(Capture $capture, bool $hearted): JsonResponse
    {
        return response()->json(['data' => ['uuid' => $capture->uuid, 'hearts_count' => $capture->hearts_count, 'hearted' => $hearted]]);
    }
}
