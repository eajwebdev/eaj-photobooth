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
        Schema::create('layouts', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('category', 20)->default('classic');
            $table->unsignedTinyInteger('shots');
            $table->unsignedSmallInteger('canvas_w');
            $table->unsignedSmallInteger('canvas_h');
            $table->string('theme', 20);
            $table->string('style', 20)->nullable();
            $table->json('slots');
            $table->json('footer');
            $table->json('text')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('layouts');
    }
};
