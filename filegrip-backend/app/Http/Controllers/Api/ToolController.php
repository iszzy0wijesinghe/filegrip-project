<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tool;
use App\Models\ToolCategory;
use Illuminate\Http\JsonResponse;

class ToolController extends Controller
{
    public function categories(): JsonResponse
    {
        $categories = ToolCategory::query()
            ->where('is_active', true)
            ->with(['tools' => function ($query) {
                $query
                    ->where('is_active', true)
                    ->orderBy('sort_order');
            }])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function index(): JsonResponse
    {
        $tools = Tool::query()
            ->where('is_active', true)
            ->with('category')
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $tools,
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $tool = Tool::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->with('category')
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $tool,
        ]);
    }
}