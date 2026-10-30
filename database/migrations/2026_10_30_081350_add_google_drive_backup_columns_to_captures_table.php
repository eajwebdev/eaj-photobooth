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
            $table->string('drive_backup_status', 20)->nullable()->index();
            $table->string('drive_folder_id', 128)->nullable();
            $table->timestamp('drive_backed_up_at')->nullable();
            $table->text('drive_backup_error')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('captures', function (Blueprint $table) {
            $table->dropIndex(['drive_backup_status']);
            $table->dropColumn([
                'drive_backup_status',
                'drive_folder_id',
                'drive_backed_up_at',
                'drive_backup_error',
            ]);
        });
    }
};
