<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#0C1C45">
        <meta name="color-scheme" content="dark">
        <meta name="format-detection" content="telephone=no">

        <title inertia>{{ config('app.name', 'Edwin & Jochel Photobooth') }}</title>

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="bg-navy font-sans antialiased">
        @inertia
    </body>
</html>
