<?php

namespace App\Http\Requests;

use App\Enums\CameraSide;
use App\Enums\CaptureType;
use App\Enums\GuestGroup;
use App\Models\Capture;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCaptureRequest extends FormRequest
{
    private ?Capture $existing = null;

    private bool $existingChecked = false;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * A retried upload that already landed is answered with the stored capture,
     * even if settings changed since (e.g. its frame was switched off), so the
     * booth's queue can never get stuck on a capture the server already has.
     */
    public function validateResolved(): void
    {
        if ($this->existingCapture() !== null) {
            return;
        }

        parent::validateResolved();
    }

    public function existingCapture(): ?Capture
    {
        if (! $this->existingChecked) {
            $this->existingChecked = true;
            $clientUuid = $this->input('client_uuid');

            $this->existing = is_string($clientUuid) && $clientUuid !== ''
                ? Capture::query()->where('client_uuid', $clientUuid)->first()
                : null;
        }

        return $this->existing;
    }

    public function captureType(): CaptureType
    {
        return CaptureType::from((string) $this->input('type'));
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isBoomerang = $this->input('type') === CaptureType::Boomerang->value;

        return [
            'client_uuid' => ['required', 'uuid'],
            'type' => ['required', Rule::enum(CaptureType::class)],
            'album_client_uuid' => ['nullable', 'uuid'],
            'layout' => [
                Rule::requiredIf($this->input('type') === CaptureType::Collage->value),
                'nullable',
                'string',
                Rule::exists('layouts', 'slug')->where('is_active', true),
            ],
            'look' => ['nullable', Rule::in(config('photobooth.looks'))],
            'media' => $isBoomerang
                ? ['required', 'file', 'mimetypes:video/mp4,video/webm,image/gif', 'max:25600']
                : ['required', 'file', 'mimes:jpg,jpeg', 'max:12288'],
            'poster' => [Rule::requiredIf($isBoomerang), 'nullable', 'file', 'mimes:jpg,jpeg', 'max:4096'],
            'shots' => ['nullable', 'array', 'max:6'],
            'shots.*' => ['file', 'mimes:jpg,jpeg', 'max:6144'],
            'signature' => ['nullable', 'file', 'mimes:png', 'max:1024'],
            'guest_name' => ['nullable', 'string', 'max:80'],
            'message' => ['nullable', 'string', 'max:280'],
            'camera' => ['nullable', Rule::enum(CameraSide::class)],
            'station' => ['nullable', 'string', 'max:40'],
            'width' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'height' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'duration_ms' => ['nullable', 'integer', 'min:0', 'max:60000'],
            'group_tag' => ['nullable', Rule::enum(GuestGroup::class)],
            'table_no' => ['nullable', 'integer', 'min:1', 'max:500'],
            'challenge_id' => ['nullable', 'integer', Rule::exists('challenges', 'id')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'layout.exists' => 'That frame is not available right now. Please choose another one.',
            'media.max' => 'This file is too large to save.',
        ];
    }
}
