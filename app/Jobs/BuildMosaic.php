<?php

namespace App\Jobs;

use App\Enums\CaptureType;
use App\Models\Capture;
use App\Models\Mosaic;
use GdImage;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * The grand-finale mosaic: the couple's photo rebuilt from every guest
 * collage. Each cell of the photo gets the best-matching thumbnail (by
 * colour, avoiding repeats), tinted toward the cell colour, with the original
 * laid over at 25% so the couple stays recognisable.
 */
class BuildMosaic implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 1200;

    /** Mostly the colour cast of each tile toward its cell (0–1). */
    private const TINT = 0.22;

    /** Keeps one photo from being repeated all over the picture. */
    private const REUSE_PENALTY = 18.0;

    public function __construct(public Mosaic $mosaic) {}

    public function uniqueId(): string
    {
        return (string) $this->mosaic->id;
    }

    public function handle(): void
    {
        ini_set('memory_limit', '1536M');
        $this->mosaic->update(['status' => Mosaic::STATUS_BUILDING, 'error' => null]);

        ['cols' => $cols, 'rows' => $rows, 'tile' => $tile, 'overlay' => $overlay, 'max_tiles' => $maxTiles] = config('photobooth.mosaic');
        $public = Storage::disk('public');

        $source = $this->loadImage((string) Storage::disk('local')->get($this->mosaic->source_path));
        $crop = $this->cropToAspect($source, $cols / $rows);
        $cells = $this->cellColours($crop, $cols, $rows);
        $tiles = $this->loadTiles($tile, $maxTiles);

        if ($tiles === []) {
            throw new RuntimeException('There are no guest collages yet to build the mosaic from.');
        }

        $width = $cols * $tile;
        $height = $rows * $tile;
        $canvas = imagecreatetruecolor($width, $height);
        $patch = imagecreatetruecolor($tile, $tile);
        $usage = array_fill(0, count($tiles), 0);
        $grid = [];
        $cropW = imagesx($crop) / $cols;
        $cropH = imagesy($crop) / $rows;

        for ($row = 0; $row < $rows; $row++) {
            for ($col = 0; $col < $cols; $col++) {
                $cell = $cells[$row][$col];
                $avoid = [$grid[$row][$col - 1] ?? -1, $grid[$row - 1][$col] ?? -1];
                $choice = $this->bestTile($tiles, $cell, $usage, $avoid);
                $grid[$row][$col] = $choice;
                $usage[$choice]++;

                $x = $col * $tile;
                $y = $row * $tile;
                imagecopy($canvas, $tiles[$choice]['image'], $x, $y, 0, 0, $tile, $tile);

                // Tint toward the cell colour.
                imagealphablending($canvas, true);
                $tint = imagecolorallocatealpha($canvas, $cell[0], $cell[1], $cell[2], (int) round(127 * (1 - self::TINT)));
                imagefilledrectangle($canvas, $x, $y, $x + $tile - 1, $y + $tile - 1, $tint);

                // Lay the original over lightly, so faces read from a distance.
                imagecopyresampled($patch, $crop, 0, 0, (int) round($col * $cropW), (int) round($row * $cropH), $tile, $tile, (int) ceil($cropW), (int) ceil($cropH));
                imagecopymerge($canvas, $patch, $x, $y, 0, 0, $tile, $tile, $overlay);
            }
        }

        $stamp = now()->format('YmdHis');
        $outputPath = "mosaics/mosaic-{$this->mosaic->id}-{$stamp}.jpg";
        $previewPath = "mosaics/mosaic-{$this->mosaic->id}-{$stamp}-preview.jpg";

        $public->put($outputPath, $this->jpeg($canvas, 82));

        $previewWidth = min(1200, $width);
        $preview = imagecreatetruecolor($previewWidth, (int) round($height * $previewWidth / $width));
        imagecopyresampled($preview, $canvas, 0, 0, 0, 0, imagesx($preview), imagesy($preview), $width, $height);
        $public->put($previewPath, $this->jpeg($preview, 84));

        foreach (array_filter([$this->mosaic->output_path, $this->mosaic->preview_path]) as $old) {
            $public->delete($old);
        }

        $this->mosaic->update([
            'status' => Mosaic::STATUS_READY,
            'output_path' => $outputPath,
            'preview_path' => $previewPath,
            'tiles' => count($tiles),
            'built_at' => now(),
        ]);
    }

    public function failed(?Throwable $exception): void
    {
        $this->mosaic->update(['status' => Mosaic::STATUS_FAILED, 'error' => mb_substr((string) $exception?->getMessage(), 0, 250)]);
    }

    /**
     * @param  list<array{image: GdImage, colour: array{0: int, 1: int, 2: int}}>  $tiles
     * @param  array{0: int, 1: int, 2: int}  $cell
     * @param  list<int>  $usage
     * @param  list<int>  $avoid
     */
    private function bestTile(array $tiles, array $cell, array $usage, array $avoid): int
    {
        $best = 0;
        $bestScore = INF;

        foreach ($tiles as $index => $tile) {
            if (in_array($index, $avoid, true) && count($tiles) > 2) {
                continue;
            }

            [$r, $g, $b] = $tile['colour'];
            $score = sqrt(($r - $cell[0]) ** 2 + ($g - $cell[1]) ** 2 + ($b - $cell[2]) ** 2) + $usage[$index] * self::REUSE_PENALTY;

            if ($score < $bestScore) {
                $bestScore = $score;
                $best = $index;
            }
        }

        return $best;
    }

    /**
     * @return list<array{image: GdImage, colour: array{0: int, 1: int, 2: int}}>
     */
    private function loadTiles(int $size, int $max): array
    {
        $public = Storage::disk('public');
        $tiles = [];

        $captures = Capture::query()
            ->visible()
            ->where('type', CaptureType::Collage)
            ->whereNotNull('thumb_path')
            ->latest('id')
            ->limit($max)
            ->pluck('thumb_path');

        foreach ($captures as $path) {
            if (! $public->exists($path)) {
                continue;
            }

            try {
                $image = $this->loadImage((string) $public->get($path));
            } catch (RuntimeException) {
                continue;
            }

            $square = $this->cropToAspect($image, 1);
            $tile = imagecreatetruecolor($size, $size);
            imagecopyresampled($tile, $square, 0, 0, 0, 0, $size, $size, imagesx($square), imagesy($square));
            $tiles[] = ['image' => $tile, 'colour' => $this->averageColour($tile)];
        }

        return $tiles;
    }

    /**
     * @return array<int, array<int, array{0: int, 1: int, 2: int}>>
     */
    private function cellColours(GdImage $image, int $cols, int $rows): array
    {
        $small = imagecreatetruecolor($cols, $rows);
        imagecopyresampled($small, $image, 0, 0, 0, 0, $cols, $rows, imagesx($image), imagesy($image));
        $cells = [];

        for ($y = 0; $y < $rows; $y++) {
            for ($x = 0; $x < $cols; $x++) {
                $rgb = imagecolorat($small, $x, $y);
                $cells[$y][$x] = [($rgb >> 16) & 0xFF, ($rgb >> 8) & 0xFF, $rgb & 0xFF];
            }
        }

        return $cells;
    }

    /**
     * @return array{0: int, 1: int, 2: int}
     */
    private function averageColour(GdImage $image): array
    {
        $pixel = imagecreatetruecolor(1, 1);
        imagecopyresampled($pixel, $image, 0, 0, 0, 0, 1, 1, imagesx($image), imagesy($image));
        $rgb = imagecolorat($pixel, 0, 0);

        return [($rgb >> 16) & 0xFF, ($rgb >> 8) & 0xFF, $rgb & 0xFF];
    }

    private function cropToAspect(GdImage $image, float $aspect): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);

        if ($width / $height > $aspect) {
            $cropWidth = (int) round($height * $aspect);
            $rect = ['x' => (int) (($width - $cropWidth) / 2), 'y' => 0, 'width' => $cropWidth, 'height' => $height];
        } else {
            $cropHeight = (int) round($width / $aspect);
            $rect = ['x' => 0, 'y' => (int) (($height - $cropHeight) / 2), 'width' => $width, 'height' => $cropHeight];
        }

        $cropped = imagecrop($image, $rect);

        if ($cropped === false) {
            throw new RuntimeException('The photo could not be cropped.');
        }

        return $cropped;
    }

    private function loadImage(string $bytes): GdImage
    {
        $image = @imagecreatefromstring($bytes);

        if ($image === false) {
            throw new RuntimeException('The photo could not be read. Please upload a JPEG or PNG.');
        }

        return $image;
    }

    private function jpeg(GdImage $image, int $quality): string
    {
        ob_start();
        imageinterlace($image, true);
        imagejpeg($image, null, $quality);

        return (string) ob_get_clean();
    }
}
