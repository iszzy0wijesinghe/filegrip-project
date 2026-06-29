<?php

namespace App\Services\FileTools;

use RuntimeException;
use setasign\Fpdi\Fpdi;

class PdfReorderPagesService
{
    public function reorder(
        string $inputPath,
        string $outputPath,
        string $pageOrderText
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $outputDirectory = dirname($outputPath);

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $probePdf = new Fpdi();
        $pageCount = $probePdf->setSourceFile($inputPath);

        $pageOrder = $this->parsePageOrder($pageOrderText, $pageCount);

        if ($this->isOriginalOrder($pageOrder)) {
            throw new RuntimeException('Please change the page order before processing.');
        }

        $outputPdf = new Fpdi();
        $outputPdf->setSourceFile($inputPath);

        foreach ($pageOrder as $pageNo) {
            $templateId = $outputPdf->importPage($pageNo);
            $size = $outputPdf->getTemplateSize($templateId);
            $orientation = $size['width'] > $size['height'] ? 'L' : 'P';

            $outputPdf->AddPage($orientation, [$size['width'], $size['height']]);
            $outputPdf->useTemplate($templateId);
        }

        $outputPdf->Output('F', $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Reordered PDF was not created.');
        }

        return [
            'page_count' => $pageCount,
            'page_order' => $pageOrder,
            'page_order_text' => implode(',', $pageOrder),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function parsePageOrder(string $input, int $pageCount): array
    {
        $input = trim($input);

        if ($input === '') {
            throw new RuntimeException('Please provide the new page order.');
        }

        $chunks = array_filter(array_map('trim', explode(',', $input)));
        $pages = [];

        foreach ($chunks as $chunk) {
            if (! preg_match('/^\d+$/', $chunk)) {
                throw new RuntimeException("Invalid page number in order: {$chunk}");
            }

            $page = (int) $chunk;

            if ($page < 1 || $page > $pageCount) {
                throw new RuntimeException("Page {$page} is outside the PDF page count.");
            }

            $pages[] = $page;
        }

        if (count($pages) !== $pageCount) {
            throw new RuntimeException('Page order must include every page exactly once.');
        }

        if (count(array_unique($pages)) !== $pageCount) {
            throw new RuntimeException('Page order cannot contain duplicate pages.');
        }

        $pagesForCheck = [...$pages];
        sort($pagesForCheck);

        for ($page = 1; $page <= $pageCount; $page++) {
            if (($pagesForCheck[$page - 1] ?? null) !== $page) {
                throw new RuntimeException('Page order must include every page exactly once.');
            }
        }

        return $pages;
    }

    /**
     * @param array<int, int> $pageOrder
     */
    private function isOriginalOrder(array $pageOrder): bool
    {
        foreach ($pageOrder as $index => $pageNo) {
            if ($pageNo !== $index + 1) {
                return false;
            }
        }

        return true;
    }
}