<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use setasign\Fpdi\Fpdi;

class ImageToPdfService
{
    /**
     * @param array<int, string> $inputPaths
     *
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     page_count: int,
     *     converted_images: array<int, array{name: string, width_px: int, height_px: int, mime_type: string}>
     * }
     */
    public function convert(array $inputPaths, string $outputPath): array
    {
        if (count($inputPaths) === 0) {
            throw new RuntimeException('No images provided.');
        }

        $outputDirectory = dirname($outputPath);

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $temporaryDirectory = $outputDirectory . DIRECTORY_SEPARATOR . 'tmp-images';

        if (! is_dir($temporaryDirectory)) {
            mkdir($temporaryDirectory, 0755, true);
        }

        $pdf = new Fpdi();
        $convertedImages = [];
        $temporaryFiles = [];

        try {
            foreach ($inputPaths as $index => $path) {
                if (! file_exists($path)) {
                    throw new RuntimeException('Image file missing.');
                }

                $imageInfo = getimagesize($path);

                if (! $imageInfo) {
                    throw new RuntimeException('Invalid image file.');
                }

                [$widthPx, $heightPx] = $imageInfo;
                $mimeType = $imageInfo['mime'] ?? '';

                if (! in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
                    throw new RuntimeException('Only JPG, PNG, and WEBP images are supported.');
                }

                $usableImagePath = $this->prepareImageForPdf(
                    inputPath: $path,
                    temporaryDirectory: $temporaryDirectory,
                    index: $index,
                    mimeType: $mimeType
                );

                if ($usableImagePath !== $path) {
                    $temporaryFiles[] = $usableImagePath;
                }

                $page = $this->calculatePageSize($widthPx, $heightPx);

                $pdf->AddPage($page['orientation'], [$page['width_mm'], $page['height_mm']]);

                $pdf->Image(
                    $usableImagePath,
                    0,
                    0,
                    $page['width_mm'],
                    $page['height_mm']
                );

                $convertedImages[] = [
                    'name' => basename($path),
                    'width_px' => $widthPx,
                    'height_px' => $heightPx,
                    'mime_type' => $mimeType,
                ];
            }

            $pdf->Output('F', $outputPath);

            if (! file_exists($outputPath) || filesize($outputPath) === 0) {
                throw new RuntimeException('PDF was not created.');
            }

            return [
                'output_file_count' => 1,
                'input_file_count' => count($inputPaths),
                'page_count' => count($inputPaths),
                'converted_images' => $convertedImages,
            ];
        } finally {
            foreach ($temporaryFiles as $temporaryFile) {
                if (file_exists($temporaryFile)) {
                    File::delete($temporaryFile);
                }
            }

            if (is_dir($temporaryDirectory)) {
                File::deleteDirectory($temporaryDirectory);
            }
        }
    }

    /**
     * @return array{width_mm: float, height_mm: float, orientation: string}
     */
    private function calculatePageSize(int $widthPx, int $heightPx): array
    {
        if ($widthPx < 1 || $heightPx < 1) {
            throw new RuntimeException('Invalid image dimensions.');
        }

        $pxToMm = 0.264583;

        $widthMm = $widthPx * $pxToMm;
        $heightMm = $heightPx * $pxToMm;

        $maxWidthMm = 210;
        $maxHeightMm = 297;

        if ($widthMm > $heightMm) {
            $maxWidthMm = 297;
            $maxHeightMm = 210;
        }

        $scale = min($maxWidthMm / $widthMm, $maxHeightMm / $heightMm, 1);

        $pageWidth = max(10, $widthMm * $scale);
        $pageHeight = max(10, $heightMm * $scale);

        return [
            'width_mm' => $pageWidth,
            'height_mm' => $pageHeight,
            'orientation' => $pageWidth > $pageHeight ? 'L' : 'P',
        ];
    }

    private function prepareImageForPdf(
        string $inputPath,
        string $temporaryDirectory,
        int $index,
        string $mimeType
    ): string {
        if ($mimeType === 'image/jpeg') {
            return $inputPath;
        }

        if (! function_exists('imagecreatetruecolor')) {
            throw new RuntimeException('Image conversion requires the PHP GD extension.');
        }

        $image = match ($mimeType) {
            'image/png' => function_exists('imagecreatefrompng')
                ? imagecreatefrompng($inputPath)
                : false,
            'image/webp' => function_exists('imagecreatefromwebp')
                ? imagecreatefromwebp($inputPath)
                : false,
            default => false,
        };

        if (! $image) {
            throw new RuntimeException('Could not read image for PDF conversion.');
        }

        $width = imagesx($image);
        $height = imagesy($image);

        $canvas = imagecreatetruecolor($width, $height);

        if (! $canvas) {
            imagedestroy($image);
            throw new RuntimeException('Could not prepare image canvas.');
        }

        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefilledrectangle($canvas, 0, 0, $width, $height, $white);
        imagecopy($canvas, $image, 0, 0, 0, 0, $width, $height);

        $temporaryPath = $temporaryDirectory . DIRECTORY_SEPARATOR . 'filegrip-image-' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT) . '.jpg';

        $saved = imagejpeg($canvas, $temporaryPath, 92);

        imagedestroy($canvas);
        imagedestroy($image);

        if (! $saved || ! file_exists($temporaryPath) || filesize($temporaryPath) === 0) {
            throw new RuntimeException('Could not prepare image for PDF output.');
        }

        return $temporaryPath;
    }
}