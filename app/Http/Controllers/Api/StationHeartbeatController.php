<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StationMonitor;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StationHeartbeatController extends Controller
{
    /**
     * Each booth device reports how many uploads it is still holding, so the
     * control room can see a booth that has been offline for a while.
     */
    public function __invoke(Request $request, StationMonitor $stations): Response
    {
        $validated = $request->validate([
            'station' => ['required', 'string', 'max:40'],
            'waiting' => ['required', 'integer', 'min:0', 'max:100000'],
            'failed' => ['required', 'integer', 'min:0', 'max:100000'],
        ]);

        $stations->record($validated['station'], $validated['waiting'], $validated['failed']);

        return response()->noContent();
    }
}
