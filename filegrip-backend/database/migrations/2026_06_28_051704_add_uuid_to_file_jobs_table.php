<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('file_jobs', function (Blueprint $table) {
            if (! Schema::hasColumn('file_jobs', 'uuid')) {
                $table->uuid('uuid')->unique()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('file_jobs', function (Blueprint $table) {
            if (Schema::hasColumn('file_jobs', 'uuid')) {
                $table->dropUnique(['uuid']);
                $table->dropColumn('uuid');
            }
        });
    }
};