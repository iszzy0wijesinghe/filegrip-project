<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use setasign\Fpdi\Fpdi;
use Symfony\Component\Process\Process;
use App\Support\BinaryResolver;

class PdfRedactService
{
    /**
     * @param array<int, array{x_percent: float|int, y_percent: float|int, width_percent: float|int, height_percent: float|int}> $boxes
     *
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     page_count: int,
     *     redaction_box_count: int,
     *     engine: string,
     *     permanently_redacted: bool
     * }
     */
    public function redact(
        string $inputPath,
        string $outputPath,
        array $boxes,
        string $pageRange = '1',
        string $redactionColor = 'black',
        bool $confirmedPermanent = false
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        if (! $confirmedPermanent) {
            throw new RuntimeException('Please confirm you understand redaction is permanent.');
        }

        if (count($boxes) === 0) {
            throw new RuntimeException('At least one redaction box is required.');
        }

        if (! function_exists('imagecreatetruecolor')) {
            throw new RuntimeException('Redaction requires the PHP GD extension.');
        }

        $this->ensureDirectory($outputPath);

        $gsPath = BinaryResolver::ghostscript();

        if (! $gsPath) {
            throw new RuntimeException('Ghostscript is not installed or could not be found.');
        }

        $temporaryDirectory = dirname($outputPath) . DIRECTORY_SEPARATOR . 'redact-temp';

        if (File::exists($temporaryDirectory)) {
            File::deleteDirectory($temporaryDirectory);
        }

        File::makeDirectory($temporaryDirectory, 0755, true);

        try {
            $pageCount = $this->pageCount($inputPath);
            $targetPages = $this->parsePageRange($pageRange, $pageCount);
            $normalizedBoxes = $this->normalizeBoxes($boxes);

            $this->renderPdfToPng($gsPath, $inputPath, $temporaryDirectory);

            $pageImages = glob($temporaryDirectory . DIRECTORY_SEPARATOR . 'page-*.png') ?: [];
            sort($pageImages);

            if (count($pageImages) === 0) {
                throw new RuntimeException('Could not render PDF pages for redaction.');
            }

            foreach ($pageImages as $index => $pageImage) {
                $pageNo = $index + 1;

                if (! in_array($pageNo, $targetPages, true)) {
                    continue;
                }

                $this->applyBoxesToImage($pageImage, $normalizedBoxes, $redactionColor);
            }

            $this->buildPdfFromImages($pageImages, $outputPath);

            if (! file_exists($outputPath) || filesize($outputPath) === 0) {
                throw new RuntimeException('Redacted PDF was not created.');
            }

            return [
                'output_file_count' => 1,
                'input_file_count' => 1,
                'page_count' => $pageCount,
                'redaction_box_count' => count($normalizedBoxes),
                'engine' => 'ghostscript-gd-fpdi',
                'permanently_redacted' => true,
            ];
        } finally {
            if (File::exists($temporaryDirectory)) {
                File::deleteDirectory($temporaryDirectory);
            }
        }
    }

    private function ensureDirectory(string $outputPath): void
    {
        $directory = dirname($outputPath);

        if (! File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }
    }

    private function pageCount(string $inputPath): int
    {
        $pdf = new Fpdi();

        return $pdf->setSourceFile($inputPath);
    }

    private function renderPdfToPng(string $gsPath, string $inputPath, string $temporaryDirectory): void
    {
        $outputPattern = $temporaryDirectory . DIRECTORY_SEPARATOR . 'page-%04d.png';

        $process = new Process([
            $gsPath,
            '-dSAFER',
            '-dBATCH',
            '-dNOPAUSE',
            '-sDEVICE=png16m',
            '-r170',
            '-dTextAlphaBits=4',
            '-dGraphicsAlphaBits=4',
            '-sOutputFile=' . $outputPattern,
            $inputPath,
        ]);

        $process->setTimeout(600);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = trim($process->getErrorOutput() ?: $process->getOutput());

            throw new RuntimeException(
                'PDF rendering for redaction failed: ' . ($error !== '' ? $error : 'Ghostscript failed without an error message.')
            );
        }
    }

    /**
     * @param array<int, array{x_percent: float, y_percent: float, width_percent: float, height_percent: float}> $boxes
     */
    private function applyBoxesToImage(string $imagePath, array $boxes, string $redactionColor): void
    {
        $image = imagecreatefrompng($imagePath);

        if (! $image) {
            throw new RuntimeException('Could not open rendered PDF page.');
        }

        $width = imagesx($image);
        $height = imagesy($image);

        $color = strtolower($redactionColor) === 'white'
            ? imagecolorallocate($image, 255, 255, 255)
            : imagecolorallocate($image, 0, 0, 0);

        foreach ($boxes as $box) {
            $x1 = (int) round(($box['x_percent'] / 100) * $width);
            $y1 = (int) round(($box['y_percent'] / 100) * $height);
            $x2 = (int) round((($box['x_percent'] + $box['width_percent']) / 100) * $width);
            $y2 = (int) round((($box['y_percent'] + $box['height_percent']) / 100) * $height);

            imagefilledrectangle(
                $image,
                max(0, min($width, $x1)),
                max(0, min($height, $y1)),
                max(0, min($width, $x2)),
                max(0, min($height, $y2)),
                $color
            );
        }

        imagepng($image, $imagePath, 6);
        imagedestroy($image);
    }

    /**
     * @param array<int, string> $pageImages
     */
    private function buildPdfFromImages(array $pageImages, string $outputPath): void
    {
        $pdf = new Fpdi();

        foreach ($pageImages as $imagePath) {
            $info = getimagesize($imagePath);

            if (! $info) {
                throw new RuntimeException('Invalid rendered page image.');
            }

            [$widthPx, $heightPx] = $info;

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

            $pageWidth = $widthMm * $scale;
            $pageHeight = $heightMm * $scale;

            $orientation = $pageWidth > $pageHeight ? 'L' : 'P';

            $pdf->AddPage($orientation, [$pageWidth, $pageHeight]);
            $pdf->Image($imagePath, 0, 0, $pageWidth, $pageHeight);
        }

        $pdf->Output('F', $outputPath);
    }

    /**
     * @return array<int, int>
     */
    private function parsePageRange(string $range, int $pageCount): array
    {
        $range = strtolower(trim($range));

        if ($range === '' || $range === 'all') {
            return range(1, $pageCount);
        }

        $pages = [];

        foreach (explode(',', $range) as $part) {
            $part = trim($part);

            if ($part === '') {
                continue;
            }

            if (str_contains($part, '-')) {
                [$start, $end] = array_map('intval', explode('-', $part, 2));

                $start = max(1, min($pageCount, $start));
                $end = max(1, min($pageCount, $end));

                if ($start > $end) {
                    [$start, $end] = [$end, $start];
                }

                foreach (range($start, $end) as $page) {
                    $pages[] = $page;
                }

                continue;
            }

            $pages[] = max(1, min($pageCount, (int) $part));
        }

        $pages = array_values(array_unique($pages));
        sort($pages);

        return count($pages) > 0 ? $pages : [1];
    }

    /**
     * @param array<int, array<string, mixed>> $boxes
     *
     * @return array<int, array{x_percent: float, y_percent: float, width_percent: float, height_percent: float}>
     */
    private function normalizeBoxes(array $boxes): array
    {
        $normalized = [];

        foreach ($boxes as $box) {
            $x = max(0, min(100, (float) ($box['x_percent'] ?? 0)));
            $y = max(0, min(100, (float) ($box['y_percent'] ?? 0)));
            $width = max(0.5, min(100, (float) ($box['width_percent'] ?? 0)));
            $height = max(0.2, min(100, (float) ($box['height_percent'] ?? 0)));

            if ($x + $width > 100) {
                $width = 100 - $x;
            }

            if ($y + $height > 100) {
                $height = 100 - $y;
            }

            if ($width <= 0 || $height <= 0) {
                continue;
            }

            $normalized[] = [
                'x_percent' => $x,
                'y_percent' => $y,
                'width_percent' => $width,
                'height_percent' => $height,
            ];
        }

        if (count($normalized) === 0) {
            throw new RuntimeException('No valid redaction boxes were provided.');
        }

        return $normalized;
    }

 
}