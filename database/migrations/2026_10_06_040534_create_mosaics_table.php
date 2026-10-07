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
        Schema::create('mosaics', function (Blueprint $table) {
            $table->id();
            $table->string('source_path');
            $table->string('output_path')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedInteger('tiles')->default(0);
            $table->timestamp('built_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mosaics');
    }
};
