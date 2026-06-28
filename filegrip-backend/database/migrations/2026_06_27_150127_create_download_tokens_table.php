<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('download_tokens', function (Blueprint $table) {
            $table->id();

            $table->foreignId('file_job_file_id')
                ->constrained('file_job_files')
                ->cascadeOnDelete();

            $table->char('token_hash', 64)->unique();

            $table->unsignedInteger('download_count')->default(0);
            $table->unsignedInteger('max_downloads')->default(5);

            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();

            $table->index('expires_at');
            $table->index('file_job_file_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('download_tokens');
    }
};