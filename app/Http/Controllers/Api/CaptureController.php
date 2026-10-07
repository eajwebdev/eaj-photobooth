<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCaptureRequest;
use App\Http\Resources\CaptureResource;
use App\Models\Capture;
use App\Services\CaptureRecorder;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class CaptureController extends Controller
{
    /**
     * Idempotent on client_uuid: a retried upload returns the stored capture (200).
     */
    public function store(StoreCaptureRequest $request, CaptureRecorder $recorder): JsonResponse
    {
        $existing = $request->existingCapture();

        ['capture' => $capture, 'created' => $created] = $existing !== null
            ? ['capture' => $existing, 'created' => false]
            : $recorder->record($request);

        return CaptureResource::make($capture->load(['album:id,code', 'layout:id,slug']))
            ->response()
            ->setStatusCode($created ? Response::HTTP_CREATED : Response::HTTP_OK);
    }

    public function show(Capture $capture): CaptureResource
    {
        abort_if($capture->is_hidden, Response::HTTP_NOT_FOUND);

        return CaptureResource::make($capture->load(['album:id,code', 'layout:id,slug']));
    }
}
