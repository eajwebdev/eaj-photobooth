<?php

use App\Services\Settings;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The looks added alongside the original four.
     *
     * @var list<string>
     */
    private const NEW_LOOKS = [
        'golden', 'blush', 'vintage', 'instant', 'seventies', 'heirloom',
        'retro', 'silver', 'vivid', 'lomo', 'dreamy', 'moody',
    ];

    /**
     * Booths whose admin already saved a list of looks get the new ones switched on too.
     */
    public function up(): void
    {
        $this->updateStoredLooks(fn (array $looks): array => array_values(array_unique([...$looks, ...self::NEW_LOOKS])));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $this->updateStoredLooks(fn (array $looks): array => array_values(array_diff($looks, self::NEW_LOOKS)));
    }

    /**
     * @param  callable(list<string>): list<string>  $change
     */
    private function updateStoredLooks(callable $change): void
    {
        $stored = DB::table('settings')->where('key', 'looks')->value('value');

        if ($stored === null) {
            return;
        }

        $looks = json_decode($stored, true);

        if (! is_array($looks)) {
            return;
        }

        $updated = $change($looks);

        if ($updated === []) {
            $updated = ['classic'];
        }

        DB::table('settings')->where('key', 'looks')->update(['value' => json_encode($updated)]);

        $defaultLook = json_decode((string) DB::table('settings')->where('key', 'default_look')->value('value'), true);

        if (is_string($defaultLook) && ! in_array($defaultLook, $updated, true)) {
            DB::table('settings')->where('key', 'default_look')->update(['value' => json_encode($updated[0])]);
        }

        app(Settings::class)->flush();
    }
};
