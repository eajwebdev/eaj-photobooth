<?php

/*
|--------------------------------------------------------------------------
| Photobooth first-run defaults
|--------------------------------------------------------------------------
|
| These values seed the `settings` table the first time the app runs.
| After that, the admin control room is the source of truth and edits
| made there win over anything in this file or in .env.
|
*/

return [

    'couple' => [
        'short' => env('PHOTOBOOTH_COUPLE_SHORT', 'Edwin & Jochel'),
        'full' => env('PHOTOBOOTH_COUPLE_FULL', 'Edwin Abril Jr. & Jochel Agnes'),
        'groom' => env('PHOTOBOOTH_GROOM', 'Edwin Abril Jr.'),
        'bride' => env('PHOTOBOOTH_BRIDE', 'Jochel Agnes'),
        'groom_short' => env('PHOTOBOOTH_GROOM_SHORT', 'Edwin'),
        'bride_short' => env('PHOTOBOOTH_BRIDE_SHORT', 'Jochel'),
    ],

    'wedding_date' => env('PHOTOBOOTH_WEDDING_DATE'),

    'venue' => env('PHOTOBOOTH_VENUE'),

    'hashtag' => env('PHOTOBOOTH_HASHTAG', '#EdwinAndJochel'),

    'thank_you_message' => env(
        'PHOTOBOOTH_THANK_YOU',
        'Thank you for celebrating with us. Every smile here is a memory we will keep for a lifetime.'
    ),

    'share_url' => env('PHOTOBOOTH_SHARE_URL', env('APP_URL', 'http://localhost')),

    'admin_pin' => env('PHOTOBOOTH_ADMIN_PIN'),

    'keepsake_pin' => env('PHOTOBOOTH_KEEPSAKE_PIN'),

    'download_prefix' => env('PHOTOBOOTH_DOWNLOAD_PREFIX', 'Edwin-Jochel-Wedding'),

    'countdown_seconds' => 3,

    'modes' => ['collage', 'boomerang'],

    'looks' => [
        'classic', 'ivory', 'golden', 'blush', 'royal',
        'vintage', 'instant', 'seventies', 'heirloom', 'retro',
        'noir', 'silver', 'vivid', 'lomo', 'dreamy', 'moody',
    ],

    'default_look' => 'classic',

    'look_picker_enabled' => true,

    'sounds_enabled' => true,

    'front_flash_enabled' => true,

    'gallery_access' => 'public',

    'gallery_code' => env('PHOTOBOOTH_GALLERY_CODE'),

    'allow_zip_downloads' => true,

    'after_wedding_mode' => false,

    'modules' => [
        'stickers' => true,
        'who_are_you' => true,
        'challenges' => true,
        'hearts' => true,
        'quiz' => true,
        'mosaic' => true,
        'backdrops' => false,
    ],

    'pose_prompts' => [
        'en' => [
            'Big smiles!',
            'Now a silly one',
            'Look at each other',
            'Group hug!',
            'Point at the camera',
            'Kiss on the cheek',
            'Your best dance move',
        ],
        'fil' => [
            "Say 'Mabuhay ang bagong kasal!'",
            'Ngiti naman diyan!',
            'Kunwari nagulat!',
        ],
    ],

    'challenges' => [
        'With someone you just met',
        "Recreate the couple's first-date pose",
        'Oldest and youngest guest together',
        'Your whole table in one photo',
        'Best barong and Filipiniana pose',
        "With the couple's parents",
        'The most dramatic dip',
        'Everyone point at the bride',
        'Tito/Tita dance moves',
        "Your best 'kilig' face",
    ],

    /*
    | Words used for readable album codes such as "ROSE-4821". Digits are
    | drawn from 2–9 so nobody mistakes a 0 for an O or a 1 for an I.
    */
    'album_words' => [
        'ROSE', 'LACE', 'RING', 'DOVE', 'VOWS', 'BELL', 'SILK', 'GOLD', 'PEARL', 'LILY',
        'GRACE', 'HEART', 'DANCE', 'CAKE', 'VEIL', 'TOAST', 'BLOOM', 'CHARM', 'SWEET', 'AMOR',
    ],

    /*
    | The grand-finale mosaic: 60 × 90 tiles of 100px = a 6000 × 9000 JPEG.
    */
    'mosaic' => [
        'cols' => 60,
        'rows' => 90,
        'tile' => 100,
        'overlay' => 25,
        'max_tiles' => 1500,
    ],

    'media' => [
        'thumb_width' => 520,
        'thumb_max_bytes' => 60 * 1024,
        'preview_width' => 1080,
        'preview_max_bytes' => 250 * 1024,
    ],

];
