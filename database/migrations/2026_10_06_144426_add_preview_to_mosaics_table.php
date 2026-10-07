<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('mosaics', function (Blueprint $table) {
            $table->string('preview_path')->nullable()->after('output_path');
            $table->string('error')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mosaics', function (Blueprint $table) {
            $table->dropColumn(['preview_path', 'error']);
        });
    }
};
