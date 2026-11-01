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
        Schema::table('captures', function (Blueprint $table) {
            // Local path => Google Drive file ID, for every file copied to Drive.
            $table->json('drive_files')->nullable()->after('drive_folder_id');
            // Set once the local copies are deleted and Drive serves the files.
            $table->timestamp('stored_in_drive_at')->nullable()->after('drive_files');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('captures', function (Blueprint $table) {
            $table->dropColumn(['drive_files', 'stored_in_drive_at']);
        });
    }
};
