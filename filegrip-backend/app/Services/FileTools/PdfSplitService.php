<?php

namespace App\Services\FileTools;

use RuntimeException;
use setasign\Fpdi\Fpdi;
use ZipArchive;

class PdfSplitService
{
    public function splitToZip(
        string $inputPath,
        string $outputDirectory,
        string $zipPath,
        array $settings
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $pageCount = $this->getPageCount($inputPath);
        $ranges = $this->resolveRanges($settings, $pageCount);

        $createdFiles = [];

        foreach ($ranges as $index => $range) {
            [$startPage, $endPage] = $range;

            $partNumber = str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT);
            $fileName = "filegrip-split-{$partNumber}-pages-{$startPage}-{$endPage}.pdf";
            $partPath = $outputDirectory . DIRECTORY_SEPARATOR . $fileName;

            $this->createPdfPart($inputPath, $partPath, $startPage, $endPage);

            $createdFiles[] = [
                'name' => $fileName,
                'path' => $partPath,
                'start_page' => $startPage,
                'end_page' => $endPage,
                'page_count' => $endPage - $startPage + 1,
                'size_bytes' => filesize($partPath) ?: 0,
            ];
        }

        $this->createZip($createdFiles, $zipPath);

        return [
            'page_count' => $pageCount,
            'output_file_count' => count($createdFiles),
            'parts' => $createdFiles,
            'zip_size_bytes' => filesize($zipPath) ?: 0,
            'ranges' => array_map(
                fn ($range) => $range[0] === $range[1]
                    ? (string) $range[0]
                    : "{$range[0]}-{$range[1]}",
                $ranges
            ),
        ];
    }

    private function getPageCount(string $inputPath): int
    {
        $pdf = new Fpdi();

        return $pdf->setSourceFile($inputPath);
    }

    private function createPdfPart(
        string $inputPath,
        string $outputPath,
        int $startPage,
        int $endPage
    ): void {
        $pdf = new Fpdi();
        $sourcePageCount = $pdf->setSourceFile($inputPath);

        if ($startPage < 1 || $endPage > $sourcePageCount || $startPage > $endPage) {
            throw new RuntimeException('Invalid page range.');
        }

        for ($pageNo = $startPage; $pageNo <= $endPage; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);
            $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

            $pdf->AddPage($orientation, [$size['width'], $size['height']]);
            $pdf->useTemplate($templateId);
        }

        $pdf->Output('F', $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Split PDF part was not created.');
        }
    }

    private function createZip(array $createdFiles, string $zipPath): void
    {
        $zipDirectory = dirname($zipPath);

        if (! is_dir($zipDirectory)) {
            mkdir($zipDirectory, 0755, true);
        }

        $zip = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create ZIP file.');
        }

        foreach ($createdFiles as $file) {
            $zip->addFile($file['path'], $file['name']);
        }

        $zip->close();

        if (! file_exists($zipPath) || filesize($zipPath) === 0) {
            throw new RuntimeException('ZIP file was not created.');
        }
    }

    private function resolveRanges(array $settings, int $pageCount): array
    {
        $mode = $settings['split_mode'] ?? 'ranges';

        return match ($mode) {
            'every_page' => $this->everyPageRanges($pageCount),
            'every_n_pages' => $this->everyNPagesRanges(
                $pageCount,
                (int) ($settings['pages_per_file'] ?? 1)
            ),
            default => $this->customRanges((string) ($settings['ranges'] ?? ''), $pageCount),
        };
    }

    private function everyPageRanges(int $pageCount): array
    {
        $ranges = [];

        for ($page = 1; $page <= $pageCount; $page++) {
            $ranges[] = [$page, $page];
        }

        return $ranges;
    }

    private function everyNPagesRanges(int $pageCount, int $pagesPerFile): array
    {
        if ($pagesPerFile < 1) {
            throw new RuntimeException('Pages per file must be greater than 0.');
        }

        $ranges = [];

        for ($start = 1; $start <= $pageCount; $start += $pagesPerFile) {
            $end = min($start + $pagesPerFile - 1, $pageCount);
            $ranges[] = [$start, $end];
        }

        return $ranges;
    }

    private function customRanges(string $rangeString, int $pageCount): array
    {
        $rangeString = trim($rangeString);

        if ($rangeString === '') {
            throw new RuntimeException('Please provide at least one page range.');
        }

        $chunks = array_filter(array_map('trim', explode(',', $rangeString)));
        $ranges = [];

        foreach ($chunks as $chunk) {
            if (preg_match('/^\d+$/', $chunk)) {
                $start = (int) $chunk;
                $end = (int) $chunk;
            } elseif (preg_match('/^(\d+)\s*-\s*(\d+)$/', $chunk, $matches)) {
                $start = (int) $matches[1];
                $end = (int) $matches[2];
            } else {
                throw new RuntimeException("Invalid page range: {$chunk}");
            }

            if ($start < 1 || $end < 1 || $start > $end || $end > $pageCount) {
                throw new RuntimeException("Page range {$chunk} is outside the PDF page count.");
            }

            $ranges[] = [$start, $end];
        }

        return $ranges;
    }
}