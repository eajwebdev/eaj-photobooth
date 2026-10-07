<?php

namespace App\Http\Requests\Admin;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
{
    /**
     * Setting keys that may be written directly (PINs are hashed separately).
     *
     * @var list<string>
     */
    public const SETTING_KEYS = [
        'couple', 'wedding_date', 'venue', 'hashtag', 'thank_you_message', 'share_url',
        'download_prefix', 'countdown_seconds', 'modes', 'looks', 'default_look',
        'look_picker_enabled', 'sounds_enabled', 'front_flash_enabled', 'gallery_access',
        'gallery_code', 'allow_zip_downloads', 'after_wedding_mode', 'modules', 'pose_prompts',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $looks = config('photobooth.looks');

        return [
            'couple' => ['sometimes', 'array:short,full,groom,bride,groom_short,bride_short'],
            'couple.*' => ['required', 'string', 'max:120'],
            'wedding_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'venue' => ['sometimes', 'nullable', 'string', 'max:160'],
            'hashtag' => ['sometimes', 'nullable', 'string', 'max:60'],
            'thank_you_message' => ['sometimes', 'nullable', 'string', 'max:500'],
            'share_url' => ['sometimes', 'url', 'max:200'],
            'download_prefix' => ['sometimes', 'string', 'max:60', 'regex:/^[A-Za-z0-9-]+$/'],
            'countdown_seconds' => ['sometimes', 'integer', 'min:2', 'max:10'],
            'modes' => ['sometimes', 'array', 'min:1'],
            'modes.*' => ['string', Rule::in(['collage', 'boomerang'])],
            'looks' => ['sometimes', 'array', 'min:1'],
            'looks.*' => ['string', Rule::in($looks)],
            'default_look' => ['sometimes', 'string', Rule::in($this->input('looks', $looks))],
            'look_picker_enabled' => ['sometimes', 'boolean'],
            'sounds_enabled' => ['sometimes', 'boolean'],
            'front_flash_enabled' => ['sometimes', 'boolean'],
            'gallery_access' => ['sometimes', Rule::in(['public', 'code'])],
            'gallery_code' => ['sometimes', 'nullable', 'required_if:gallery_access,code', 'string', 'min:3', 'max:40'],
            'allow_zip_downloads' => ['sometimes', 'boolean'],
            'after_wedding_mode' => ['sometimes', 'boolean'],
            'modules' => ['sometimes', 'array:stickers,who_are_you,challenges,hearts,quiz,mosaic,backdrops'],
            'modules.*' => ['boolean'],
            'pose_prompts' => ['sometimes', 'array:en,fil'],
            'pose_prompts.*' => ['array', 'max:30'],
            'pose_prompts.*.*' => ['string', 'max:80'],
            'admin_pin' => ['sometimes', 'string', 'regex:/^\d{4,8}$/'],
            'keepsake_pin' => ['sometimes', 'string', 'regex:/^\d{4,8}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'admin_pin.regex' => 'The admin PIN must be 4 to 8 digits.',
            'keepsake_pin.regex' => 'The keepsake PIN must be 4 to 8 digits.',
        ];
    }
}
