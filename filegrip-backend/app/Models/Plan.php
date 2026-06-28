<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'price_monthly',
        'price_yearly',
        'currency',
        'max_file_size_mb',
        'max_files_per_job',
        'daily_job_limit',
        'monthly_job_limit',
        'batch_limit',
        'storage_limit_mb',
        'priority_level',
        'can_store_files',
        'can_use_batch',
        'can_use_api',
        'has_ads',
        'is_active',
    ];

    protected $casts = [
        'price_monthly' => 'decimal:2',
        'price_yearly' => 'decimal:2',
        'can_store_files' => 'boolean',
        'can_use_batch' => 'boolean',
        'can_use_api' => 'boolean',
        'has_ads' => 'boolean',
        'is_active' => 'boolean',
    ];
}