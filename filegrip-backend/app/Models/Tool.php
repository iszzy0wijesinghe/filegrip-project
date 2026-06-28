<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tool extends Model
{
    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'description',
        'short_description',
        'input_types',
        'output_types',
        'is_active',
        'is_premium',
        'requires_login',
        'max_file_count',
        'max_file_size_mb',
        'sort_order',
        'seo_title',
        'seo_description',
    ];

    protected $casts = [
        'input_types' => 'array',
        'output_types' => 'array',
        'is_active' => 'boolean',
        'is_premium' => 'boolean',
        'requires_login' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(ToolCategory::class, 'category_id');
    }
}