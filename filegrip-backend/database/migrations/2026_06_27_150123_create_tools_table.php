<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tools', function (Blueprint $table) {
            $table->id();

            $table->foreignId('category_id')
                ->nullable()
                ->constrained('tool_categories')
                ->nullOnDelete();

            $table->string('name', 120);
            $table->string('slug', 120)->unique();

            $table->text('description')->nullable();
            $table->string('short_description', 255)->nullable();

            $table->json('input_types')->nullable();
            $table->json('output_types')->nullable();

            $table->boolean('is_active')->default(true);
            $table->boolean('is_premium')->default(false);
            $table->boolean('requires_login')->default(false);

            $table->unsignedInteger('max_file_count')->nullable();
            $table->unsignedInteger('max_file_size_mb')->nullable();

            $table->unsignedInteger('sort_order')->default(0);

            $table->string('seo_title', 190)->nullable();
            $table->string('seo_description', 255)->nullable();

            $table->timestamps();

            $table->index('slug');
            $table->index(['category_id', 'is_active']);
            $table->index(['is_active', 'sort_order']);
            $table->index('is_premium');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tools');
    }
};