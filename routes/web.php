<?php

use App\Http\Controllers\AlbumPageController;
use App\Http\Controllers\BoothController;
use App\Http\Controllers\CapturePageController;
use App\Http\Controllers\DevFramesController;
use App\Http\Controllers\WelcomeController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', WelcomeController::class)->name('home');

Route::inertia('admin', 'admin/index')->name('admin');

Route::get('booth', BoothController::class)->name('booth');
Route::get('p/{uuid}', CapturePageController::class)->whereUuid('uuid')->name('capture.show');
Route::get('a/{code}', AlbumPageController::class)->where('code', '[A-Za-z]{2,10}-[0-9]{4}')->name('album.show');

Route::get('gallery', fn (Request $request) => Inertia::render('gallery', [
    'slideshow' => $request->boolean('slideshow'),
]))->name('gallery');

Route::inertia('keepsake', 'keepsake')->name('keepsake');

if (app()->environment('local')) {
    Route::get('dev/frames', DevFramesController::class)->name('dev.frames');
}

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
