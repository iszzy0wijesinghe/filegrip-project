<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use setasign\Fpdi\Fpdi;

class PdfSignService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     page_count: int,
     *     engine: string,
     *     signed: bool
     * }
     */
    public function sign(
        string $inputPath,
        string $outputPath,
        string $signatureMode,
        string $signatureValue,
        float $positionX,
        float $positionY,
        int $signatureSize = 34,
        string $pageRange = '1',
        ?string $uploadedSignatureImagePath = null
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $signatureMode = strtolower(trim($signatureMode));
        $signatureSize = max(12, min(120, $signatureSize));
        $positionX = max(0, min(100, $positionX));
        $positionY = max(0, min(100, $positionY));

        if (! in_array($signatureMode, ['draw', 'type', 'upload'], true)) {
            throw new RuntimeException('Invalid signature mode.');
        }

        $this->ensureDirectory($outputPath);

        $temporaryDirectory = dirname($outputPath) . DIRECTORY_SEPARATOR . 'signature-temp';

        if (File::exists($temporaryDirectory)) {
            File::deleteDirectory($temporaryDirectory);
        }

        File::makeDirectory($temporaryDirectory, 0755, true);

        $temporaryImagePath = null;

        try {
            $pdf = new Fpdi();
            $pageCount = $pdf->setSourceFile($inputPath);
            $targetPages = $this->parsePageRange($pageRange, $pageCount);

            if ($signatureMode === 'draw') {
                $temporaryImagePath = $this->saveBase64Signature($signatureValue, $temporaryDirectory);
            }

            if ($signatureMode === 'upload') {
                if (! $uploadedSignatureImagePath || ! file_exists($uploadedSignatureImagePath)) {
                    throw new RuntimeException('Uploaded signature image missing.');
                }

                $temporaryImagePath = $this->prepareSignatureImage($uploadedSignatureImagePath, $temporaryDirectory);
            }

            for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                $templateId = $pdf->importPage($pageNo);
                $size = $pdf->getTemplateSize($templateId);

                $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

                $pdf->AddPage($orientation, [$size['width'], $size['height']]);
                $pdf->useTemplate($templateId);

                if (! in_array($pageNo, $targetPages, true)) {
                    continue;
                }

                $centerX = ($positionX / 100) * $size['width'];
                $centerY = ($positionY / 100) * $size['height'];

                if ($signatureMode === 'type') {
                    $this->drawTypedSignature($pdf, $signatureValue, $centerX, $centerY, $signatureSize);
                    continue;
                }

                if (! $temporaryImagePath) {
                    throw new RuntimeException('Signature image could not be prepared.');
                }

                $this->drawImageSignature($pdf, $temporaryImagePath, $centerX, $centerY, $signatureSize);
            }

            $pdf->Output('F', $outputPath);

            if (! file_exists($outputPath) || filesize($outputPath) === 0) {
                throw new RuntimeException('Signed PDF was not created.');
            }

            return [
                'output_file_count' => 1,
                'input_file_count' => 1,
                'page_count' => $pageCount,
                'engine' => 'fpdi-fpdf',
                'signed' => true,
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

    private function drawTypedSignature(
        Fpdi $pdf,
        string $text,
        float $centerX,
        float $centerY,
        int $signatureSize
    ): void {
        $text = trim($text);

        if ($text === '') {
            throw new RuntimeException('Typed signature is empty.');
        }

        $fontSize = max(10, min(72, $signatureSize));
        $pdf->SetTextColor(17, 24, 39);
        $pdf->SetFont('Times', 'I', $fontSize);

        $textWidth = $pdf->GetStringWidth($text);
        $x = $centerX - ($textWidth / 2);
        $y = $centerY + ($fontSize * 0.25);

        $pdf->Text($x, $y, $text);
    }

    private function drawImageSignature(
        Fpdi $pdf,
        string $imagePath,
        float $centerX,
        float $centerY,
        int $signatureSize
    ): void {
        $info = getimagesize($imagePath);

        if (! $info) {
            throw new RuntimeException('Invalid signature image.');
        }

        [$widthPx, $heightPx] = $info;

        $widthMm = max(24, $signatureSize * 2.8);
        $heightMm = $widthMm * ($heightPx / max(1, $widthPx));

        $x = $centerX - ($widthMm / 2);
        $y = $centerY - ($heightMm / 2);

        $pdf->Image($imagePath, $x, $y, $widthMm, $heightMm);
    }

    private function saveBase64Signature(string $signatureValue, string $temporaryDirectory): string
    {
        if (! str_starts_with($signatureValue, 'data:image/png;base64,')) {
            throw new RuntimeException('Invalid drawn signature data.');
        }

        $base64 = substr($signatureValue, strlen('data:image/png;base64,'));
        $binary = base64_decode($base64, true);

        if ($binary === false || strlen($binary) < 20) {
            throw new RuntimeException('Could not decode drawn signature.');
        }

        $path = $temporaryDirectory . DIRECTORY_SEPARATOR . 'drawn-signature.png';

        file_put_contents($path, $binary);

        if (! file_exists($path) || filesize($path) === 0) {
            throw new RuntimeException('Could not save drawn signature.');
        }

        return $path;
    }

    private function prepareSignatureImage(string $inputPath, string $temporaryDirectory): string
    {
        $info = getimagesize($inputPath);

        if (! $info) {
            throw new RuntimeException('Invalid signature image.');
        }

        $mime = $info['mime'] ?? '';

        if ($mime === 'image/png') {
            return $inputPath;
        }

        if (! function_exists('imagecreatetruecolor')) {
            throw new RuntimeException('Signature image conversion requires the PHP GD extension.');
        }

        $image = match ($mime) {
            'image/jpeg' => imagecreatefromjpeg($inputPath),
            'image/webp' => function_exists('imagecreatefromwebp') ? imagecreatefromwebp($inputPath) : false,
            default => false,
        };

        if (! $image) {
            throw new RuntimeException('Only PNG, JPG, and WEBP signature images are supported.');
        }

        imagepalettetotruecolor($image);
        imagealphablending($image, false);
        imagesavealpha($image, true);

        $outputPath = $temporaryDirectory . DIRECTORY_SEPARATOR . 'uploaded-signature.png';

        $saved = imagepng($image, $outputPath, 6);

        imagedestroy($image);

        if (! $saved || ! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Could not prepare signature image.');
        }

        return $outputPath;
    }
}