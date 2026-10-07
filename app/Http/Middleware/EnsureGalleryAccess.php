<?php

namespace App\Http\Middleware;

use App\Services\Settings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * When the couple chooses "wedding code required", the full gallery listing
 * needs that code (X-Gallery-Code header or gallery_code cookie). Albums and
 * single capture links stay reachable: their codes are already private.
 */
class EnsureGalleryAccess
{
    public function __construct(private Settings $settings) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->settings->galleryRequiresCode()) {
            return $next($request);
        }

        $code = $request->header('X-Gallery-Code') ?? $request->cookie('gallery_code');

        if (! $this->settings->galleryCodeMatches(is_string($code) ? $code : null)) {
            return response()->json([
                'message' => 'Enter the wedding code to see the photos.',
                'requires_code' => true,
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $next($request);
    }
}
