<?php

namespace App\Http\Middleware;

use App\Services\Settings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards staff and couple endpoints with a PIN sent in the X-Admin-Pin or
 * X-Keepsake-Pin header. Wrong guesses are rate limited per device.
 *
 * Usage: ->middleware('pin:admin') or ->middleware('pin:keepsake')
 */
class EnsurePin
{
    public const MAX_FAILURES = 5;

    public const LOCKOUT_SECONDS = 60;

    public function __construct(private Settings $settings) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $kind = 'admin'): Response
    {
        $limiterKey = "pin-failures:{$kind}:".$request->ip();

        if (RateLimiter::tooManyAttempts($limiterKey, self::MAX_FAILURES)) {
            $seconds = RateLimiter::availableIn($limiterKey);

            return response()->json([
                'message' => "Too many wrong PINs. Please wait {$seconds} seconds and try again.",
            ], Response::HTTP_TOO_MANY_REQUESTS, ['Retry-After' => (string) $seconds]);
        }

        $pin = $request->header('X-'.ucfirst($kind).'-Pin');

        if (! $this->settings->pinMatches($kind, is_string($pin) ? $pin : null)) {
            RateLimiter::hit($limiterKey, self::LOCKOUT_SECONDS);

            return response()->json(['message' => 'That PIN is not right. Please try again.'], Response::HTTP_UNAUTHORIZED);
        }

        RateLimiter::clear($limiterKey);

        return $next($request);
    }
}
