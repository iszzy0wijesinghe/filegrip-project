<?php

use App\Http\Controllers\Api\FileJobController;
use App\Http\Controllers\Api\PlanController;
use App\Http\Controllers\Api\ToolController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('/plans', [PlanController::class, 'index']);

    Route::get('/tool-categories', [ToolController::class, 'categories']);
    Route::get('/tools', [ToolController::class, 'index']);
    Route::get('/tools/{slug}', [ToolController::class, 'show']);

    Route::post('/tools/{slug}/process', [FileJobController::class, 'process']);
    Route::get('/file-jobs/{uuid}', [FileJobController::class, 'show']);
    Route::get('/downloads/{token}', [FileJobController::class, 'download']);
});