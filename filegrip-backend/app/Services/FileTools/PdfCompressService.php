<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Process\Process;

class PdfCompressService
{
    public function compress(string $inputPath, string $outputPath): array
    {
        $outputDirectory = dirname($outputPath);

        if (! File::exists($outputDirectory)) {
            File::makeDirectory($outputDirectory, 0755, true);
        }

        $inputSize = filesize($inputPath) ?: 0;
        $temporaryOutputPath = $outputPath . '.tmp.pdf';

        $ghostscriptPath = $this->ghostscriptPath();

        if ($ghostscriptPath) {
            $this->compressWithGhostscript(
                $ghostscriptPath,
                $inputPath,
                $temporaryOutputPath
            );
        } else {
            File::copy($inputPath, $temporaryOutputPath);
        }

        $compressedSize = file_exists($temporaryOutputPath)
            ? (filesize($temporaryOutputPath) ?: 0)
            : 0;

        if ($compressedSize > 0 && $compressedSize < $inputSize) {
            File::move($temporaryOutputPath, $outputPath);

            return [
                'was_compressed' => true,
                'input_size_bytes' => $inputSize,
                'output_size_bytes' => $compressedSize,
                'saved_bytes' => $inputSize - $compressedSize,
                'saved_percent' => round((($inputSize - $compressedSize) / $inputSize) * 100, 2),
                'engine' => 'ghostscript',
            ];
        }

        if (file_exists($temporaryOutputPath)) {
            File::delete($temporaryOutputPath);
        }

        File::copy($inputPath, $outputPath);

        return [
            'was_compressed' => false,
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $inputSize,
            'saved_bytes' => 0,
            'saved_percent' => 0,
            'engine' => $ghostscriptPath ? 'ghostscript-no-gain' : 'copy-fallback',
        ];
    }

    private function ghostscriptPath(): ?string
    {
        $paths = [
            '/opt/homebrew/bin/gs',
            '/usr/local/bin/gs',
            '/usr/bin/gs',
        ];

        foreach ($paths as $path) {
            if (is_executable($path)) {
                return $path;
            }
        }

        $process = new Process(['which', 'gs']);
        $process->run();

        if ($process->isSuccessful()) {
            $path = trim($process->getOutput());

            if ($path !== '' && is_executable($path)) {
                return $path;
            }
        }

        return null;
    }

    private function compressWithGhostscript(
        string $ghostscriptPath,
        string $inputPath,
        string $outputPath
    ): void {
        $process = new Process([
            $ghostscriptPath,
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/screen',
            '-dDetectDuplicateImages=true',
            '-dCompressFonts=true',
            '-dSubsetFonts=true',
            '-dDownsampleColorImages=true',
            '-dColorImageResolution=96',
            '-dDownsampleGrayImages=true',
            '-dGrayImageResolution=96',
            '-dDownsampleMonoImages=true',
            '-dMonoImageResolution=150',
            '-dAutoRotatePages=/None',
            '-dNOPAUSE',
            '-dQUIET',
            '-dBATCH',
            '-sOutputFile=' . $outputPath,
            $inputPath,
        ]);

        $process->setTimeout(180);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException('PDF compression failed: ' . $process->getErrorOutput());
        }

        if (! File::exists($outputPath) || File::size($outputPath) === 0) {
            throw new RuntimeException('Compressed PDF was not created.');
        }
    }
}