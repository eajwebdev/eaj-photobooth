<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizAttempt extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['device_id', 'name', 'score', 'answers'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'answers' => 'array',
            'score' => 'integer',
        ];
    }
}
