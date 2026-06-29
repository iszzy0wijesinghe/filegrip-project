<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;

class ImageCompressService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     input_size_bytes: int,
     *     output_size_bytes: int,
     *     saved_bytes: int,
     *     saved_percent: float,
     *     output_format: string,
     *     width: int,
     *     height: int,
     *     engine: string
     * }
     */
    public function compress(
        string $inputPath,
        string $outputPath,
        string $outputFormat,
        int $quality = 78
    ): array {
        $quality = max(30, min(100, $quality));
        $outputFormat = $this->normalizeFormat($outputFormat);

        [$image, $width, $height] = $this->loadImage($inputPath);

        $this->ensureDirectory($outputPath);
        $this->saveImage($image, $outputPath, $outputFormat, $quality);

        imagedestroy($image);

        $inputSize = filesize($inputPath) ?: 0;
        $outputSize = filesize($outputPath) ?: 0;

        if ($outputSize <= 0) {
            throw new RuntimeException('Compressed image was not created.');
        }

        $savedBytes = max(0, $inputSize - $outputSize);
        $savedPercent = $inputSize > 0
            ? round(($savedBytes / $inputSize) * 100, 2)
            : 0;

        return [
            'output_file_count' => 1,
            'input_file_count' => 1,
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'saved_bytes' => $savedBytes,
            'saved_percent' => $savedPercent,
            'output_format' => $outputFormat,
            'width' => $width,
            'height' => $height,
            'engine' => 'php-gd',
        ];
    }

    private function ensureDirectory(string $outputPath): void
    {
        $directory = dirname($outputPath);

        if (! File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }
    }

    private function normalizeFormat(string $format): string
    {
        $format = strtolower(trim($format));

        if ($format === 'jpeg') {
            return 'jpg';
        }

        if (! in_array($format, ['jpg', 'png', 'webp'], true)) {
            return 'webp';
        }

        return $format;
    }

    /**
     * @return array{0: \GdImage, 1: int, 2: int}
     */
    private function loadImage(string $inputPath): array
    {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input image file missing.');
        }

        $info = getimagesize($inputPath);

        if (! $info) {
            throw new RuntimeException('Invalid image file.');
        }

        [$width, $height] = $info;
        $mime = $info['mime'] ?? '';

        $image = match ($mime) {
            'image/jpeg' => imagecreatefromjpeg($inputPath),
            'image/png' => imagecreatefrompng($inputPath),
            'image/webp' => function_exists('imagecreatefromwebp')
                ? imagecreatefromwebp($inputPath)
                : false,
            default => false,
        };

        if (! $image) {
            throw new RuntimeException('Only JPG, PNG, and WEBP images are supported.');
        }

        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);

        return [$image, $width, $height];
    }

    private function saveImage(\GdImage $image, string $outputPath, string $format, int $quality): void
    {
        $saved = match ($format) {
            'jpg' => $this->saveJpg($image, $outputPath, $quality),
            'png' => imagepng($image, $outputPath, $this->pngCompressionLevel($quality)),
            'webp' => function_exists('imagewebp')
                ? imagewebp($image, $outputPath, $quality)
                : false,
            default => false,
        };

        if (! $saved || ! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Could not save compressed image.');
        }
    }

    private function saveJpg(\GdImage $image, string $outputPath, int $quality): bool
    {
        $width = imagesx($image);
        $height = imagesy($image);

        $canvas = imagecreatetruecolor($width, $height);

        if (! $canvas) {
            return false;
        }

        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefilledrectangle($canvas, 0, 0, $width, $height, $white);
        imagecopy($canvas, $image, 0, 0, 0, 0, $width, $height);

        $saved = imagejpeg($canvas, $outputPath, $quality);

        imagedestroy($canvas);

        return $saved;
    }

    private function pngCompressionLevel(int $quality): int
    {
        return (int) round(9 - (($quality / 100) * 9));
    }
}