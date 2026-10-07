<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizQuestion extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['question', 'choices', 'answer_index', 'sort'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'choices' => 'array',
            'answer_index' => 'integer',
            'sort' => 'integer',
        ];
    }
}
