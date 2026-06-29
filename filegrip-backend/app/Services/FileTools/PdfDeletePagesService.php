<?php

namespace App\Services\FileTools;

use RuntimeException;
use setasign\Fpdi\Fpdi;

class PdfDeletePagesService
{
    public function deletePages(
        string $inputPath,
        string $outputPath,
        string $deletePagesText
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $outputDirectory = dirname($outputPath);

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $sourcePdf = new Fpdi();
        $pageCount = $sourcePdf->setSourceFile($inputPath);

        $pagesToDelete = $this->parsePagesToDelete($deletePagesText, $pageCount);

        if (count($pagesToDelete) === 0) {
            throw new RuntimeException('Please select at least one page to delete.');
        }

        if (count($pagesToDelete) >= $pageCount) {
            throw new RuntimeException('You must keep at least one page in the final PDF.');
        }

        $deleteLookup = array_flip($pagesToDelete);
        $keptPages = [];

        $outputPdf = new Fpdi();
        $outputPdf->setSourceFile($inputPath);

        for ($pageNo = 1; $pageNo <= $pageCount; $pageNo++) {
            if (isset($deleteLookup[$pageNo])) {
                continue;
            }

            $templateId = $outputPdf->importPage($pageNo);
            $size = $outputPdf->getTemplateSize($templateId);
            $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

            $outputPdf->AddPage($orientation, [$size['width'], $size['height']]);
            $outputPdf->useTemplate($templateId);

            $keptPages[] = $pageNo;
        }

        $outputPdf->Output('F', $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Cleaned PDF was not created.');
        }

        return [
            'page_count' => $pageCount,
            'deleted_pages' => $pagesToDelete,
            'deleted_pages_text' => $this->compressPagesToRangeText($pagesToDelete),
            'kept_pages' => $keptPages,
            'kept_pages_text' => $this->compressPagesToRangeText($keptPages),
            'deleted_count' => count($pagesToDelete),
            'kept_count' => count($keptPages),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function parsePagesToDelete(string $input, int $pageCount): array
    {
        $input = trim($input);

        if ($input === '') {
            throw new RuntimeException('Please provide pages to delete.');
        }

        $chunks = array_filter(array_map('trim', explode(',', $input)));
        $pages = [];

        foreach ($chunks as $chunk) {
            if (preg_match('/^\d+$/', $chunk)) {
                $page = (int) $chunk;

                $this->validatePage($page, $pageCount, $chunk);

                $pages[] = $page;
                continue;
            }

            if (! preg_match('/^(\d+)\s*-\s*(\d+)$/', $chunk, $matches)) {
                throw new RuntimeException("Invalid page range: {$chunk}");
            }

            $start = (int) $matches[1];
            $end = (int) $matches[2];

            if ($start > $end) {
                throw new RuntimeException("Invalid page range: {$chunk}");
            }

            $this->validatePage($start, $pageCount, $chunk);
            $this->validatePage($end, $pageCount, $chunk);

            for ($page = $start; $page <= $end; $page++) {
                $pages[] = $page;
            }
        }

        $pages = array_values(array_unique($pages));
        sort($pages);

        return $pages;
    }

    private function validatePage(int $page, int $pageCount, string $source): void
    {
        if ($page < 1 || $page > $pageCount) {
            throw new RuntimeException("Page range {$source} is outside the PDF page count.");
        }
    }

    /**
     * @param array<int, int> $pages
     */
    private function compressPagesToRangeText(array $pages): string
    {
        if (count($pages) === 0) {
            return '';
        }

        $pages = array_values(array_unique($pages));
        sort($pages);

        $ranges = [];
        $start = $pages[0];
        $previous = $pages[0];

        for ($index = 1; $index < count($pages); $index++) {
            $current = $pages[$index];

            if ($current === $previous + 1) {
                $previous = $current;
                continue;
            }

            $ranges[] = $start === $previous
                ? (string) $start
                : "{$start}-{$previous}";

            $start = $current;
            $previous = $current;
        }

        $ranges[] = $start === $previous
            ? (string) $start
            : "{$start}-{$previous}";

        return implode(', ', $ranges);
    }
}