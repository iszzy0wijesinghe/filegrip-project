<?php

namespace App\Services\FileTools;

use App\Support\BinaryResolver;
use Illuminate\Support\Facades\File;
use RuntimeException;
use setasign\Fpdi\Fpdi;
use Symfony\Component\Process\Process;
use ZipArchive;

class PdfToImageService
{
    /**
     * @return array{
     *     page_count: int,
     *     output_file_count: int,
     *     format: string,
     *     zip_size_bytes: int,
     *     files: array<int, array{name: string, path: string, size_bytes: int}>
     * }
     */
    public function convertToZip(
        string $inputPath,
        string $outputDirectory,
        string $zipPath,
        string $format
    ): array {
        if (! File::exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $format = strtolower(trim($format));

        if (! in_array($format, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            throw new RuntimeException('Invalid image output format.');
        }

        if ($format === 'jpeg') {
            $format = 'jpg';
        }

        if (! File::exists($outputDirectory)) {
            File::makeDirectory($outputDirectory, 0755, true);
        }

        $ghostscriptPath = BinaryResolver::ghostscript();

        if (! $ghostscriptPath) {
            throw new RuntimeException('Ghostscript is not installed or could not be found.');
        }

        $pageCount = $this->getPageCount($inputPath);

        if ($pageCount < 1) {
            throw new RuntimeException('Could not read pages from this PDF.');
        }

        if ($format === 'webp') {
            $pngPattern = $outputDirectory . DIRECTORY_SEPARATOR . 'filegrip-page-%03d.png';

            $this->renderWithGhostscript(
                ghostscriptPath: $ghostscriptPath,
                inputPath: $inputPath,
                outputPattern: $pngPattern,
                format: 'png'
            );

            $this->convertPngImagesToWebp($outputDirectory);
            $createdFiles = $this->collectCreatedImages($outputDirectory, 'webp');
        } else {
            $outputPattern = $outputDirectory . DIRECTORY_SEPARATOR . 'filegrip-page-%03d.' . $format;

            $this->renderWithGhostscript(
                ghostscriptPath: $ghostscriptPath,
                inputPath: $inputPath,
                outputPattern: $outputPattern,
                format: $format
            );

            $createdFiles = $this->collectCreatedImages($outputDirectory, $format);
        }

        if (count($createdFiles) === 0) {
            throw new RuntimeException('No images were created from the PDF.');
        }

        $this->createZip($createdFiles, $zipPath);

        return [
            'page_count' => $pageCount,
            'output_file_count' => count($createdFiles),
            'format' => $format,
            'zip_size_bytes' => File::size($zipPath) ?: 0,
            'files' => $createdFiles,
        ];
    }

    private function getPageCount(string $inputPath): int
    {
        $qpdfPath = BinaryResolver::qpdf();

        if ($qpdfPath) {
            $process = new Process([
                $qpdfPath,
                '--show-npages',
                str_replace('\\', '/', $inputPath),
            ]);

            $process->setTimeout(120);
            $process->run();

            if ($process->isSuccessful()) {
                $pageCount = (int) trim($process->getOutput());

                if ($pageCount > 0) {
                    return $pageCount;
                }
            }
        }

        try {
            $pdf = new Fpdi();

            return $pdf->setSourceFile($inputPath);
        } catch (\Throwable $e) {
            throw new RuntimeException('Could not read PDF page count: ' . $e->getMessage());
        }
    }

    private function renderWithGhostscript(
        string $ghostscriptPath,
        string $inputPath,
        string $outputPattern,
        string $format
    ): void {
        $outputDirectory = dirname($outputPattern);

        if (! File::exists($outputDirectory)) {
            File::makeDirectory($outputDirectory, 0755, true);
        }

        $ghostscriptTempDirectory = storage_path('app/filegrip-tmp/ghostscript');

        if (! File::exists($ghostscriptTempDirectory)) {
            File::makeDirectory($ghostscriptTempDirectory, 0755, true);
        }

        $inputPath = str_replace('\\', '/', $inputPath);
        $outputPattern = str_replace('\\', '/', $outputPattern);
        $ghostscriptTempDirectory = str_replace('\\', '/', $ghostscriptTempDirectory);

        $device = match ($format) {
            'png' => 'png16m',
            default => 'jpeg',
        };

        $command = [
            $ghostscriptPath,

            // Safe batch rendering
            '-dSAFER',
            '-dBATCH',
            '-dNOPAUSE',
            '-dQUIET',

            // Better quality
            '-r200',
            '-dTextAlphaBits=4',
            '-dGraphicsAlphaBits=4',

            // Important for PDFs with strange CropBox/MediaBox/rotation metadata.
            // This usually fixes cropped or shifted output.
            '-dUseCropBox',
            '-dPrinted=false',

            '-sDEVICE=' . $device,
        ];

        if ($format === 'jpg') {
            $command[] = '-dJPEGQ=90';
        }

        $command[] = '-sOutputFile=' . $outputPattern;
        $command[] = $inputPath;

        $process = new Process(
            $command,
            $outputDirectory,
            [
                'TEMP' => $ghostscriptTempDirectory,
                'TMP' => $ghostscriptTempDirectory,
                'TMPDIR' => $ghostscriptTempDirectory,
                'GS_TMPDIR' => $ghostscriptTempDirectory,
            ]
        );

        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = trim($process->getErrorOutput() ?: $process->getOutput());

            throw new RuntimeException('PDF to image conversion failed: ' . $error);
        }
    }

    private function convertPngImagesToWebp(string $outputDirectory): void
    {
        if (! function_exists('imagecreatefrompng') || ! function_exists('imagewebp')) {
            throw new RuntimeException('WEBP conversion requires the PHP GD extension with WEBP support.');
        }

        $pngFiles = glob($outputDirectory . DIRECTORY_SEPARATOR . '*.png') ?: [];

        sort($pngFiles, SORT_NATURAL);

        if (count($pngFiles) === 0) {
            throw new RuntimeException('No temporary PNG files were created for WEBP conversion.');
        }

        foreach ($pngFiles as $pngPath) {
            $image = imagecreatefrompng($pngPath);

            if (! $image) {
                throw new RuntimeException('Could not read temporary PNG image.');
            }

            $webpPath = preg_replace('/\.png$/i', '.webp', $pngPath);

            if (! $webpPath) {
                imagedestroy($image);
                throw new RuntimeException('Could not create WEBP output path.');
            }

            imagepalettetotruecolor($image);
            imagealphablending($image, true);
            imagesavealpha($image, true);

            $success = imagewebp($image, $webpPath, 86);

            imagedestroy($image);

            if (! $success || ! File::exists($webpPath) || File::size($webpPath) === 0) {
                throw new RuntimeException('Could not convert PNG page to WEBP.');
            }

            File::delete($pngPath);
        }
    }

    /**
     * @return array<int, array{name: string, path: string, size_bytes: int}>
     */
    private function collectCreatedImages(string $outputDirectory, string $extension): array
    {
        $files = glob($outputDirectory . DIRECTORY_SEPARATOR . '*.' . $extension) ?: [];

        sort($files, SORT_NATURAL);

        return array_values(array_map(function (string $path) {
            return [
                'name' => basename($path),
                'path' => $path,
                'size_bytes' => File::size($path) ?: 0,
            ];
        }, $files));
    }

    /**
     * @param array<int, array{name: string, path: string, size_bytes: int}> $createdFiles
     */
    private function createZip(array $createdFiles, string $zipPath): void
    {
        $zipDirectory = dirname($zipPath);

        if (! File::exists($zipDirectory)) {
            File::makeDirectory($zipDirectory, 0755, true);
        }

        $zip = new ZipArchive();

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create ZIP file.');
        }

        foreach ($createdFiles as $file) {
            $zip->addFile($file['path'], $file['name']);
        }

        $zip->close();

        if (! File::exists($zipPath) || File::size($zipPath) === 0) {
            throw new RuntimeException('ZIP file was not created.');
        }
    }
}