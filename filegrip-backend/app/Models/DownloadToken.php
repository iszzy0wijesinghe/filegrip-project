<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DownloadToken extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'file_job_file_id',
        'token_hash',
        'download_count',
        'max_downloads',
        'expires_at',
        'created_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function file(): BelongsTo
    {
        return $this->belongsTo(FileJobFile::class, 'file_job_file_id');
    }
}