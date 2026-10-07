<?php

namespace App\Http\Requests\Admin;

use App\Enums\CaptureType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListCapturesRequest extends FormRequest
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
            'hidden' => ['nullable', 'boolean'],
            'station' => ['nullable', 'string', 'max:40'],
            'album' => ['nullable', 'string', 'max:16'],
            'q' => ['nullable', 'string', 'max:80'],
        ];
    }
}
