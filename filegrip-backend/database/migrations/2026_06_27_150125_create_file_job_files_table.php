<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_job_files', function (Blueprint $table) {
            $table->id();

            $table->foreignId('file_job_id')
                ->constrained('file_jobs')
                ->cascadeOnDelete();

            $table->enum('file_role', [
                'input',
                'output',
                'preview',
                'thumbnail',
            ]);

            $table->string('original_name', 255)->nullable();
            $table->string('stored_name', 255);
            $table->string('mime_type', 120)->nullable();
            $table->string('extension', 20)->nullable();

            $table->unsignedBigInteger('size_bytes')->default(0);

            $table->string('storage_disk', 50)->default('local');
            $table->text('storage_path');

            $table->char('checksum_sha256', 64)->nullable();

            $table->boolean('is_deleted')->default(false);
            $table->timestamp('deleted_at')->nullable();

            $table->timestamps();

            $table->index(['file_job_id', 'file_role']);
            $table->index('checksum_sha256');
            $table->index('is_deleted');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_job_files');
    }
};