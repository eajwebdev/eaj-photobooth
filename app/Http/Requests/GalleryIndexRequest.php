<?php

namespace App\Http\Requests;

use App\Enums\CaptureType;
use App\Enums\GuestGroup;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GalleryIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['nullable', Rule::enum(CaptureType::class)],
            'q' => ['nullable', 'string', 'max:80'],
            'album' => ['nullable', 'string', 'max:16'],
            'after' => ['nullable', 'integer', 'min:0'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:60'],
            'cursor' => ['nullable', 'string'],
            'group' => ['nullable', Rule::enum(GuestGroup::class)],
            'challenge' => ['nullable', 'integer', 'min:1'],
            'sort' => ['nullable', Rule::in(['newest', 'loved'])],
        ];
    }
}
