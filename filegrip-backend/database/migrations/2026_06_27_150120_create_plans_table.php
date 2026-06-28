<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();

            $table->string('name', 100);
            $table->string('slug', 100)->unique();

            $table->decimal('price_monthly', 10, 2)->default(0.00);
            $table->decimal('price_yearly', 10, 2)->default(0.00);
            $table->string('currency', 10)->default('USD');

            $table->unsignedInteger('max_file_size_mb')->default(25);
            $table->unsignedInteger('max_files_per_job')->default(5);
            $table->unsignedInteger('daily_job_limit')->default(10);
            $table->unsignedInteger('monthly_job_limit')->default(300);
            $table->unsignedInteger('batch_limit')->default(1);
            $table->unsignedInteger('storage_limit_mb')->default(0);

            $table->unsignedTinyInteger('priority_level')->default(1);

            $table->boolean('can_store_files')->default(false);
            $table->boolean('can_use_batch')->default(false);
            $table->boolean('can_use_api')->default(false);
            $table->boolean('has_ads')->default(true);

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index('slug');
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};