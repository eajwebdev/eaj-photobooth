<?php

use App\Http\Controllers\Api\Admin\CaptureController as AdminCaptureController;
use App\Http\Controllers\Api\Admin\ChallengeController as AdminChallengeController;
use App\Http\Controllers\Api\Admin\LayoutController as AdminLayoutController;
use App\Http\Controllers\Api\Admin\MosaicController;
use App\Http\Controllers\Api\Admin\QuizController as AdminQuizController;
use App\Http\Controllers\Api\Admin\QuizQuestionController;
use App\Http\Controllers\Api\Admin\SessionController as PinSessionController;
use App\Http\Controllers\Api\Admin\SettingsController as AdminSettingsController;
use App\Http\Controllers\Api\Admin\StatsController as AdminStatsController;
use App\Http\Controllers\Api\AlbumController;
use App\Http\Controllers\Api\AlbumZipController;
use App\Http\Controllers\Api\CaptureController;
use App\Http\Controllers\Api\CaptureDownloadController;
use App\Http\Controllers\Api\ChallengeController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\GalleryController;
use App\Http\Controllers\Api\HeartController;
use App\Http\Controllers\Api\Keepsake\CaptureController as KeepsakeCaptureController;
use App\Http\Controllers\Api\Keepsake\GuestbookController;
use App\Http\Controllers\Api\LayoutController;
use App\Http\Controllers\Api\PartyStateController;
use App\Http\Controllers\Api\QuizController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StationHeartbeatController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:browse')->group(function () {
    Route::get('settings/public', [SettingsController::class, 'show'])->name('api.settings.public');
    Route::get('layouts', [LayoutController::class, 'index'])->name('api.layouts.index');
    Route::get('gallery', [GalleryController::class, 'index'])->middleware('gallery.access')->name('api.gallery.index');
    Route::get('albums/{album}', [AlbumController::class, 'show'])->name('api.albums.show');
    Route::get('captures/{capture}', [CaptureController::class, 'show'])->name('api.captures.show');
    Route::get('challenges', [ChallengeController::class, 'index'])->name('api.challenges.index');
    Route::get('quiz', [QuizController::class, 'questions'])->name('api.quiz.questions');
    Route::get('quiz/leaderboard', [QuizController::class, 'leaderboard'])->name('api.quiz.leaderboard');
    Route::get('quiz/attempts/{deviceId}', [QuizController::class, 'mine'])->whereUuid('deviceId')->name('api.quiz.mine');
    Route::get('party/state', PartyStateController::class)->name('api.party.state');
});

Route::middleware('throttle:hearts')->group(function () {
    Route::post('captures/{capture}/heart', [HeartController::class, 'store'])->name('api.hearts.store');
    Route::delete('captures/{capture}/heart', [HeartController::class, 'destroy'])->name('api.hearts.destroy');
    Route::post('quiz/attempts', [QuizController::class, 'attempt'])->name('api.quiz.attempt');
});

Route::middleware('throttle:downloads')->group(function () {
    Route::get('albums/{album}/zip', AlbumZipController::class)->name('api.albums.zip');
    Route::get('captures/{capture}/download', CaptureDownloadController::class)->name('api.captures.download');
    Route::get('exports/{export}/download', [ExportController::class, 'download'])
        ->middleware('signed:relative')
        ->name('exports.download');
});

Route::middleware('throttle:uploads')->group(function () {
    Route::post('albums', [AlbumController::class, 'store'])->name('api.albums.store');
    Route::post('captures', [CaptureController::class, 'store'])->name('api.captures.store');
    Route::post('stations/heartbeat', StationHeartbeatController::class)->name('api.stations.heartbeat');
});

Route::prefix('admin')->name('admin.')->middleware(['throttle:admin', 'pin:admin'])->group(function () {
    Route::post('session', [PinSessionController::class, 'store'])->name('session.store');
    Route::get('stats', AdminStatsController::class)->name('stats');
    Route::get('captures', [AdminCaptureController::class, 'index'])->name('captures.index');
    Route::patch('captures/{capture}', [AdminCaptureController::class, 'update'])->name('captures.update');
    Route::delete('captures/{capture}', [AdminCaptureController::class, 'destroy'])->name('captures.destroy');
    Route::get('layouts', [AdminLayoutController::class, 'index'])->name('layouts.index');
    Route::patch('layouts/{layout}', [AdminLayoutController::class, 'update'])->name('layouts.update');
    Route::get('settings', [AdminSettingsController::class, 'show'])->name('settings.show');
    Route::put('settings', [AdminSettingsController::class, 'update'])->name('settings.update');
    Route::post('exports', [ExportController::class, 'store'])->name('exports.store');
    Route::get('exports/{export}', [ExportController::class, 'show'])->name('exports.show');

    Route::get('challenges', [AdminChallengeController::class, 'index'])->name('challenges.index');
    Route::post('challenges', [AdminChallengeController::class, 'store'])->name('challenges.store');
    Route::patch('challenges/{challenge}', [AdminChallengeController::class, 'update'])->name('challenges.update');
    Route::delete('challenges/{challenge}', [AdminChallengeController::class, 'destroy'])->name('challenges.destroy');

    Route::get('quiz/questions', [QuizQuestionController::class, 'index'])->name('quiz.questions.index');
    Route::post('quiz/questions', [QuizQuestionController::class, 'store'])->name('quiz.questions.store');
    Route::put('quiz/questions/{question}', [QuizQuestionController::class, 'update'])->name('quiz.questions.update');
    Route::delete('quiz/questions/{question}', [QuizQuestionController::class, 'destroy'])->name('quiz.questions.destroy');
    Route::get('quiz/attempts', [AdminQuizController::class, 'attempts'])->name('quiz.attempts');
    Route::post('quiz/reveal', [AdminQuizController::class, 'reveal'])->name('quiz.reveal');
    Route::post('quiz/reset', [AdminQuizController::class, 'reset'])->name('quiz.reset');

    Route::get('mosaic', [MosaicController::class, 'show'])->name('mosaic.show');
    Route::post('mosaic', [MosaicController::class, 'store'])->name('mosaic.store');
    Route::post('mosaic/rebuild', [MosaicController::class, 'rebuild'])->name('mosaic.rebuild');
    Route::post('mosaic/reveal', [MosaicController::class, 'reveal'])->name('mosaic.reveal');
    Route::post('mosaic/hide', [MosaicController::class, 'hide'])->name('mosaic.hide');
});

// The couple's private keepsake, after the wedding.
Route::prefix('keepsake')->name('keepsake.')->middleware(['throttle:admin', 'pin:keepsake'])->group(function () {
    Route::post('session', [PinSessionController::class, 'store'])->name('session.store');
    Route::get('guestbook', [GuestbookController::class, 'index'])->name('guestbook.index');
    Route::get('captures', [KeepsakeCaptureController::class, 'index'])->name('captures.index');
    Route::post('exports', [ExportController::class, 'store'])->name('exports.store');
    Route::get('exports/{export}', [ExportController::class, 'show'])->name('exports.show');
});
