<?php

namespace App\Services\FileTools;

use RuntimeException;
use setasign\Fpdi\Fpdi;

class ImageToPdfService
{
    /**
     * @param array<int, string> $inputPaths
     */
    public function convert(array $inputPaths, string $outputPath): void
    {
        if (count($inputPaths) === 0) {
            throw new RuntimeException('No images provided.');
        }

        $outputDirectory = dirname($outputPath);

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $pdf = new Fpdi();

        foreach ($inputPaths as $path) {
            if (! file_exists($path)) {
                throw new RuntimeException('Image file missing.');
            }

            $imageSize = getimagesize($path);

            if (! $imageSize) {
                throw new RuntimeException('Invalid image file.');
            }

            [$widthPx, $heightPx] = $imageSize;

            $widthMm = $widthPx * 0.264583;
            $heightMm = $heightPx * 0.264583;

            $maxWidthMm = 210;
            $maxHeightMm = 297;

            $scale = min($maxWidthMm / $widthMm, $maxHeightMm / $heightMm, 1);

            $pageWidth = $widthMm * $scale;
            $pageHeight = $heightMm * $scale;

            $orientation = $pageWidth > $pageHeight ? 'L' : 'P';

            $pdf->AddPage($orientation, [$pageWidth, $pageHeight]);
            $pdf->Image($path, 0, 0, $pageWidth, $pageHeight);
        }

        $pdf->Output('F', $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('PDF was not created.');
        }
    }
}