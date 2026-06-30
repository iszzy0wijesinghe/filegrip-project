<?php

namespace App\Services\FileTools;

use App\Support\BinaryResolver;
use Illuminate\Support\Facades\File;
use RuntimeException;
use setasign\Fpdi\Fpdi;
use Symfony\Component\Process\Process;

class PdfMergeService
{
    /**
     * @param array<int, string> $inputPaths
     */
    public function merge(array $inputPaths, string $outputPath): void
    {
        if (count($inputPaths) < 2) {
            throw new RuntimeException('At least two PDF files are required for merging.');
        }

        $outputDirectory = dirname($outputPath);

        if (! File::exists($outputDirectory)) {
            File::makeDirectory($outputDirectory, 0755, true);
        }

        $qpdfPath = BinaryResolver::qpdf();

        if ($qpdfPath) {
            $this->mergeWithQpdf($qpdfPath, $inputPaths, $outputPath);

            return;
        }

        $this->mergeWithFpdi($inputPaths, $outputPath);
    }

    /**
     * @param array<int, string> $inputPaths
     */
    private function mergeWithQpdf(string $qpdfPath, array $inputPaths, string $outputPath): void
    {
        $arguments = [
            $qpdfPath,
            '--empty',
            '--pages',
        ];

        foreach ($inputPaths as $inputPath) {
            if (! File::exists($inputPath)) {
                throw new RuntimeException('Input PDF not found: ' . $inputPath);
            }

            $arguments[] = str_replace('\\', '/', $inputPath);
        }

        $arguments[] = '--';
        $arguments[] = str_replace('\\', '/', $outputPath);

        $process = new Process($arguments, dirname($outputPath));
        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = trim($process->getErrorOutput() ?: $process->getOutput());

            throw new RuntimeException('PDF merge failed: ' . $error);
        }

        if (! File::exists($outputPath) || File::size($outputPath) === 0) {
            throw new RuntimeException('Merged PDF was not created.');
        }
    }

    /**
     * @param array<int, string> $inputPaths
     */
    private function mergeWithFpdi(array $inputPaths, string $outputPath): void
    {
        $pdf = new Fpdi();

        foreach ($inputPaths as $path) {
            if (! File::exists($path)) {
                throw new RuntimeException('Input PDF not found: ' . $path);
            }

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

        if (! File::exists($outputPath) || File::size($outputPath) === 0) {
            throw new RuntimeException('Merged PDF was not created.');
        }
    }
}