<?php

namespace App\Services\FileTools;

use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use RuntimeException;
use Smalot\PdfParser\Parser;

class PdfToWordService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     page_count: int,
     *     engine: string
     * }
     */
    public function convert(string $inputPath, string $outputPath): array
    {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $outputDirectory = dirname($outputPath);

        if (! is_dir($outputDirectory)) {
            mkdir($outputDirectory, 0755, true);
        }

        $parser = new Parser();
        $pdf = $parser->parseFile($inputPath);
        $pages = $pdf->getPages();

        if (count($pages) === 0) {
            throw new RuntimeException('Could not read any pages from this PDF.');
        }

        $phpWord = new PhpWord();

        $phpWord->setDefaultFontName('Arial');
        $phpWord->setDefaultFontSize(11);

        $properties = $phpWord->getDocInfo();
        $properties->setCreator('FileGrip');
        $properties->setCompany('Motiora');
        $properties->setTitle('Converted PDF to Word');
        $properties->setDescription('Converted by FileGrip PDF to Word tool.');

        foreach ($pages as $pageIndex => $page) {
            $section = $phpWord->addSection([
                'marginTop' => 900,
                'marginRight' => 900,
                'marginBottom' => 900,
                'marginLeft' => 900,
            ]);

            $text = trim($page->getText());

            if ($text === '') {
                $section->addText(
                    'This page did not contain selectable text. It may be a scanned or image-based PDF.',
                    [
                        'italic' => true,
                        'color' => '78716C',
                    ]
                );

                continue;
            }

            $lines = preg_split("/\r\n|\n|\r/", $text) ?: [];

            foreach ($lines as $line) {
                $line = trim($line);

                if ($line === '') {
                    $section->addTextBreak(1);
                    continue;
                }

                $section->addText(
                    $this->cleanText($line),
                    [
                        'name' => 'Arial',
                        'size' => 11,
                        'color' => '111827',
                    ],
                    [
                        'spaceAfter' => 120,
                        'lineHeight' => 1.15,
                    ]
                );
            }

            if ($pageIndex < count($pages) - 1) {
                $section->addPageBreak();
            }
        }

        $writer = IOFactory::createWriter($phpWord, 'Word2007');
        $writer->save($outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Word document was not created.');
        }

        return [
            'output_file_count' => 1,
            'input_file_count' => 1,
            'page_count' => count($pages),
            'engine' => 'pdfparser-phpword',
        ];
    }

    private function cleanText(string $text): string
    {
        $text = preg_replace('/[^\P{C}\t\r\n]/u', '', $text) ?? $text;
        $text = preg_replace('/\s+/', ' ', $text) ?? $text;

        return trim($text);
    }
}