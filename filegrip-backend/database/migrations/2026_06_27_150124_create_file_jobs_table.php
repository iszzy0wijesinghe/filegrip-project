<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_jobs', function (Blueprint $table) {
            $table->id();

            $table->uuid('job_uuid')->unique();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            $table->foreignId('tool_id')
                ->constrained('tools')
                ->restrictOnDelete();

            $table->enum('status', [
                'pending',
                'queued',
                'processing',
                'completed',
                'failed',
                'expired',
                'deleted',
            ])->default('pending');

            $table->unsignedTinyInteger('priority')->default(1);

            $table->unsignedInteger('input_file_count')->default(0);
            $table->unsignedInteger('output_file_count')->default(0);

            $table->unsignedBigInteger('total_input_size_bytes')->default(0);
            $table->unsignedBigInteger('total_output_size_bytes')->default(0);

            $table->json('settings')->nullable();

            $table->string('error_code', 100)->nullable();
            $table->text('error_message')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('deleted_at')->nullable();

            $table->timestamps();

            $table->index('job_uuid');
            $table->index(['user_id', 'status']);
            $table->index(['tool_id', 'status']);
            $table->index(['status', 'priority']);
            $table->index('expires_at');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_jobs');
    }
};