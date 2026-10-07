<?php

namespace App\Services;

use GdImage;
use RuntimeException;

/**
 * Small, fast gallery images made with GD: a resized JPEG kept under a byte
 * budget, plus the dominant colour used as the blur-up placeholder.
 */
class ImageDerivatives
{
    /**
     * @return array{bytes: string, width: int, height: int}
     */
    public function resizedJpeg(string $sourceBytes, int $maxWidth, int $maxBytes): array
    {
        $source = $this->load($sourceBytes);
        $width = imagesx($source);
        $height = imagesy($source);

        $targetWidth = min($width, $maxWidth);
        $targetHeight = max(1, (int) round($height * ($targetWidth / $width)));

        $resized = imagecreatetruecolor($targetWidth, $targetHeight);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
        imageinterlace($resized, true);

        $bytes = '';

        foreach ([82, 76, 70, 64, 58, 52, 46, 40] as $quality) {
            $bytes = $this->encode($resized, $quality);

            if (strlen($bytes) <= $maxBytes) {
                break;
            }
        }

        return ['bytes' => $bytes, 'width' => $targetWidth, 'height' => $targetHeight];
    }

    /**
     * Average colour of the image as "#rrggbb".
     */
    public function dominantColor(string $sourceBytes): string
    {
        $source = $this->load($sourceBytes);
        $pixel = imagecreatetruecolor(1, 1);
        imagecopyresampled($pixel, $source, 0, 0, 0, 0, 1, 1, imagesx($source), imagesy($source));
        $rgb = imagecolorat($pixel, 0, 0);

        return sprintf('#%02x%02x%02x', ($rgb >> 16) & 0xFF, ($rgb >> 8) & 0xFF, $rgb & 0xFF);
    }

    /**
     * @return array{width: int, height: int}|null
     */
    public function dimensions(string $path): ?array
    {
        $size = @getimagesize($path);

        return $size === false ? null : ['width' => $size[0], 'height' => $size[1]];
    }

    private function load(string $bytes): GdImage
    {
        $image = @imagecreatefromstring($bytes);

        if ($image === false) {
            throw new RuntimeException('The image could not be read.');
        }

        return $image;
    }

    private function encode(GdImage $image, int $quality): string
    {
        ob_start();
        imagejpeg($image, null, $quality);

        return (string) ob_get_clean();
    }
}
