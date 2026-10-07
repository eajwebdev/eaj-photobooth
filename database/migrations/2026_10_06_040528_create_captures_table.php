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
        Schema::create('captures', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->uuid('client_uuid')->unique();
            $table->enum('type', ['collage', 'boomerang']);
            $table->foreignId('layout_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('album_id')->nullable()->constrained()->nullOnDelete();
            $table->string('look', 20)->nullable();
            $table->string('media_path');
            $table->string('poster_path')->nullable();
            $table->string('thumb_path')->nullable();
            $table->string('preview_path')->nullable();
            $table->string('dominant_color', 7)->nullable();
            $table->string('mime', 40);
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->unsignedInteger('size_bytes');
            $table->string('guest_name', 80)->nullable()->index();
            $table->string('message', 280)->nullable();
            $table->string('signature_path')->nullable();
            $table->enum('camera', ['front', 'back', 'upload'])->default('front');
            $table->string('station', 40)->nullable();
            $table->string('device', 160)->nullable();
            $table->string('ip', 45)->nullable();
            $table->boolean('is_hidden')->default(false)->index();
            $table->unsignedInteger('downloads')->default(0);
            $table->string('group_tag', 30)->nullable();
            $table->unsignedSmallInteger('table_no')->nullable();
            $table->foreignId('challenge_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('hearts_count')->default(0);
            $table->boolean('is_couple_favourite')->default(false);
            $table->timestamps();

            $table->index(['is_hidden', 'type', 'id']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('captures');
    }
};
