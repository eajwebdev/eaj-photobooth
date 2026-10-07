<?php

namespace App\Providers;

use App\Services\Settings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Scoped (not singleton) so long-running queue workers see admin edits.
        $this->app->scoped(Settings::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Every guest at the venue may share one public IP through the venue
     * Wi-Fi, so the guest-facing limits are deliberately generous.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('browse', fn (Request $request) => Limit::perMinute(3000)->by($request->ip()));

        RateLimiter::for('downloads', fn (Request $request) => Limit::perMinute(600)->by($request->ip()));

        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(240)
            ->by($request->ip().'|'.$request->input('station')));

        // Hearts and quiz answers: generous per venue, strict per phone.
        RateLimiter::for('hearts', fn (Request $request) => [
            Limit::perMinute(40)->by('device:'.$request->input('device_id').'|'.$request->ip()),
            Limit::perMinute(1500)->by('venue:'.$request->ip()),
        ]);

        RateLimiter::for('admin', fn (Request $request) => Limit::perMinute(300)->by($request->ip()));
    }
}
