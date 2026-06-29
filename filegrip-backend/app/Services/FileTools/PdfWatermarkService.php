<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use setasign\Fpdi\Fpdi;

class PdfWatermarkService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     page_count: int,
     *     engine: string,
     *     watermarked: bool
     * }
     */
    public function addWatermark(
        string $inputPath,
        string $outputPath,
        string $text,
        int $fontSize = 42,
        int $opacity = 28,
        int $rotation = -35,
        string $position = 'center',
        bool $repeatWatermark = false,
        string $pageRange = 'all'
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $text = trim($text);

        if ($text === '') {
            throw new RuntimeException('Watermark text is required.');
        }

        $fontSize = max(8, min(120, $fontSize));
        $opacity = max(5, min(100, $opacity));

        /*
         * Frontend CSS rotation and FPDF rotation use opposite visual directions.
         * Keep frontend values unchanged and invert only for PDF output.
         */
        $rotation = max(-90, min(90, $rotation));
        $pdfRotation = -$rotation;

        $this->ensureDirectory($outputPath);

        $pdf = new WatermarkFpdi();
        $pageCount = $pdf->setSourceFile($inputPath);
        $targetPages = $this->parsePageRange($pageRange, $pageCount);

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

            $pdf->AddPage($orientation, [$size['width'], $size['height']]);
            $pdf->useTemplate($templateId);

            if (! in_array($pageNo, $targetPages, true)) {
                continue;
            }

            $pdf->SetTextColor(249, 115, 22);
            $pdf->SetFont('Helvetica', 'B', $fontSize);
            $pdf->SetAlpha($opacity / 100);

            if ($repeatWatermark) {
                $this->drawRepeatedWatermark(
                    $pdf,
                    $text,
                    $size['width'],
                    $size['height'],
                    $pdfRotation
                );
            } else {
                [$x, $y] = $this->positionToCoordinates(
                    $position,
                    $size['width'],
                    $size['height'],
                    $fontSize
                );

                $pdf->RotatedText($x, $y, $text, $pdfRotation);
            }

            $pdf->SetAlpha(1);
        }

        $pdf->Output('F', $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Watermarked PDF was not created.');
        }

        return [
            'output_file_count' => 1,
            'input_file_count' => 1,
            'page_count' => $pageCount,
            'engine' => 'fpdi-fpdf',
            'watermarked' => true,
        ];
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

            $page = max(1, min($pageCount, (int) $part));
            $pages[] = $page;
        }

        $pages = array_values(array_unique($pages));
        sort($pages);

        return count($pages) > 0 ? $pages : range(1, $pageCount);
    }

    /**
     * Returns the visual anchor point for each watermark position.
     *
     * The actual text is centered around this point inside WatermarkFpdi::RotatedText().
     * This keeps frontend position C/ML/MR/TC/etc. aligned with processed PDF output,
     * even when the watermark is rotated.
     *
     * @return array{0: float, 1: float}
     */
    private function positionToCoordinates(
        string $position,
        float $pageWidth,
        float $pageHeight,
        int $fontSize
    ): array {
        $margin = 22;
        $lineHeightOffset = $fontSize * 0.12;

        return match ($position) {
            'top-left' => [$margin, $margin],
            'top-center' => [$pageWidth / 2, $margin],
            'top-right' => [$pageWidth - $margin, $margin],

            'middle-left' => [$margin, ($pageHeight / 2) + $lineHeightOffset],
            'middle-right' => [$pageWidth - $margin, ($pageHeight / 2) + $lineHeightOffset],

            'bottom-left' => [$margin, $pageHeight - $margin],
            'bottom-center' => [$pageWidth / 2, $pageHeight - $margin],
            'bottom-right' => [$pageWidth - $margin, $pageHeight - $margin],

            default => [$pageWidth / 2, ($pageHeight / 2) + $lineHeightOffset],
        };
    }

    private function drawRepeatedWatermark(
        WatermarkFpdi $pdf,
        string $text,
        float $pageWidth,
        float $pageHeight,
        int $rotation
    ): void {
        $stepX = max(65, $pageWidth / 3);
        $stepY = max(55, $pageHeight / 5);

        for ($y = 35; $y < $pageHeight + $stepY; $y += $stepY) {
            for ($x = -20; $x < $pageWidth + $stepX; $x += $stepX) {
                $pdf->RotatedText($x, $y, $text, $rotation);
            }
        }
    }
}

class WatermarkFpdi extends Fpdi
{
    protected array $extGStates = [];

    protected float $angle = 0.0;

    public function SetAlpha(float $alpha): void
    {
        $alpha = max(0, min(1, $alpha));

        $gs = $this->AddExtGState([
            'ca' => $alpha,
            'CA' => $alpha,
            'BM' => '/Normal',
        ]);

        $this->SetExtGState($gs);
    }

    public function RotatedText(float $x, float $y, string $text, float $angle): void
    {
        $textWidth = $this->GetStringWidth($text);
        $fontHeight = $this->FontSize;

        /*
         * Treat $x/$y as the visual center anchor.
         * FPDF Text() draws from the left baseline, so offset it here.
         */
        $textX = $x - ($textWidth / 2);
        $textY = $y + ($fontHeight / 3);

        $this->Rotate($angle, $x, $y);
        $this->Text($textX, $textY, $text);
        $this->Rotate(0);
    }

    public function Rotate(float $angle, float $x = -1, float $y = -1): void
    {
        if ($x === -1) {
            $x = $this->x;
        }

        if ($y === -1) {
            $y = $this->y;
        }

        if ($this->angle !== 0.0) {
            $this->_out('Q');
        }

        $this->angle = $angle;

        if ($angle !== 0.0) {
            $angle *= M_PI / 180;
            $c = cos($angle);
            $s = sin($angle);
            $cx = $x * $this->k;
            $cy = ($this->h - $y) * $this->k;

            $this->_out(
                sprintf(
                    'q %.5F %.5F %.5F %.5F %.5F %.5F cm 1 0 0 1 %.5F %.5F cm',
                    $c,
                    $s,
                    -$s,
                    $c,
                    $cx,
                    $cy,
                    -$cx,
                    -$cy
                )
            );
        }
    }

    public function _endpage(): void
    {
        if ($this->angle !== 0.0) {
            $this->angle = 0.0;
            $this->_out('Q');
        }

        parent::_endpage();
    }

    protected function AddExtGState(array $parameters): int
    {
        $number = count($this->extGStates) + 1;
        $this->extGStates[$number] = $parameters;

        return $number;
    }

    protected function SetExtGState(int $gs): void
    {
        $this->_out(sprintf('/GS%d gs', $gs));
    }

    protected function _putextgstates(): void
    {
        foreach ($this->extGStates as $number => $parameters) {
            $this->_newobj();
            $this->extGStates[$number]['n'] = $this->n;
            $this->_put('<< /Type /ExtGState');

            foreach ($parameters as $key => $value) {
                $this->_put(
                    '/' . $key . ' ' . (is_float($value) ? sprintf('%.3F', $value) : $value)
                );
            }

            $this->_put('>>');
            $this->_put('endobj');
        }
    }

    protected function _putresourcedict(): void
    {
        parent::_putresourcedict();

        $this->_put('/ExtGState <<');

        foreach ($this->extGStates as $number => $parameters) {
            $this->_put(sprintf('/GS%d %d 0 R', $number, $parameters['n']));
        }

        $this->_put('>>');
    }

    protected function _putresources(): void
    {
        $this->_putextgstates();
        parent::_putresources();
    }
}