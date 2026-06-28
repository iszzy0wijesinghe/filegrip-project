<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FileJob extends Model
{
protected $fillable = [
    'uuid',
    'job_uuid',
    'user_id',
    'tool_id',
    'status',
    'priority',
    'input_file_count',
    'output_file_count',
    'total_input_size_bytes',
    'total_output_size_bytes',
    'settings',
    'error_code',
    'error_message',
    'ip_address',
    'user_agent',
    'started_at',
    'finished_at',
    'expires_at',
    'deleted_at',
];

    protected $casts = [
        'settings' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'expires_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    

    public function tool(): BelongsTo
    {
        return $this->belongsTo(Tool::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(FileJobFile::class);
    }
}