<?php

namespace App\Services\FileTools;

use setasign\Fpdi\Fpdi;

class PdfMergeService
{
    /**
     * @param array<int, string> $inputPaths
     */
    public function merge(array $inputPaths, string $outputPath): void
    {
        $pdf = new Fpdi();

        foreach ($inputPaths as $path) {
            $pageCount = $pdf->setSourceFile($path);

            for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
                $templateId = $pdf->importPage($pageNo);
                $size = $pdf->getTemplateSize($templateId);

                $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

                $pdf->AddPage($orientation, [$size['width'], $size['height']]);
                $pdf->useTemplate($templateId);
            }
        }

        $pdf->Output('F', $outputPath);
    }
}