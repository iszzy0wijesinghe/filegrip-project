<?php

namespace App\Services\FileTools;

use RuntimeException;
use setasign\Fpdi\Fpdi;

class PdfRotateService
{
    public function rotate(string $inputPath, string $outputPath, int $rotation): void
    {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        if (! in_array($rotation, [90, 180, 270], true)) {
            throw new RuntimeException('Invalid rotation value.');
        }

        $pdfRotation = match ($rotation) {
    90 => 270,
    180 => 180,
    270 => 90,
};

        $outputDirectory = dirname($outputPath);

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $pdf = new RotatableFpdi();
        $pageCount = $pdf->setSourceFile($inputPath);

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);

            $originalWidth = $size['width'];
            $originalHeight = $size['height'];

            if ($rotation === 90 || $rotation === 270) {
                $pageWidth = $originalHeight;
                $pageHeight = $originalWidth;
            } else {
                $pageWidth = $originalWidth;
                $pageHeight = $originalHeight;
            }

            $orientation = $pageWidth > $pageHeight ? 'L' : 'P';

            $pdf->AddPage($orientation, [$pageWidth, $pageHeight]);

            $x = ($pageWidth - $originalWidth) / 2;
            $y = ($pageHeight - $originalHeight) / 2;

         $pdf->Rotate($pdfRotation, $pageWidth / 2, $pageHeight / 2);
            $pdf->useTemplate($templateId, $x, $y, $originalWidth, $originalHeight);
            $pdf->Rotate(0);
        }

        $pdf->Output('F', $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Rotated PDF was not created.');
        }
    }
}

class RotatableFpdi extends Fpdi
{
    protected int $angle = 0;

    public function Rotate(int $angle, float $x = -1, float $y = -1): void
    {
        if ($x === -1) {
            $x = $this->x;
        }

        if ($y === -1) {
            $y = $this->y;
        }

        if ($this->angle !== 0) {
            $this->_out('Q');
        }

        $this->angle = $angle;

        if ($angle !== 0) {
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
        if ($this->angle !== 0) {
            $this->angle = 0;
            $this->_out('Q');
        }

        parent::_endpage();
    }
}