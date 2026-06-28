<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FileJobFile extends Model
{
    protected $fillable = [
        'file_job_id',
        'file_role',
        'original_name',
        'stored_name',
        'mime_type',
        'extension',
        'size_bytes',
        'storage_disk',
        'storage_path',
        'checksum_sha256',
        'is_deleted',
        'deleted_at',
    ];

    protected $casts = [
        'is_deleted' => 'boolean',
        'deleted_at' => 'datetime',
    ];

    public function job(): BelongsTo
    {
        return $this->belongsTo(FileJob::class, 'file_job_id');
    }

    public function downloadTokens(): HasMany
    {
        return $this->hasMany(DownloadToken::class);
    }
}