<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_deletion_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('file_job_id')
                ->nullable()
                ->constrained('file_jobs')
                ->nullOnDelete();

            $table->foreignId('file_job_file_id')
                ->nullable()
                ->constrained('file_job_files')
                ->nullOnDelete();

            $table->string('storage_disk', 50)->nullable();
            $table->text('storage_path')->nullable();

            $table->enum('deletion_status', [
                'success',
                'failed',
            ])->default('success');

            $table->text('error_message')->nullable();

            $table->timestamp('deleted_at')->nullable();

            $table->index(['file_job_id', 'deleted_at']);
            $table->index('deletion_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_deletion_logs');
    }
};