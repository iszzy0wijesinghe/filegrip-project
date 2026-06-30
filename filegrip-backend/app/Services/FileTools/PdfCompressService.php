<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Process\Process;
use App\Support\BinaryResolver;

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

        $ghostscriptPath = BinaryResolver::ghostscript();

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

  

    private function compressWithGhostscript(
    string $ghostscriptPath,
    string $inputPath,
    string $outputPath
): void {
    $outputDirectory = dirname($outputPath);

    if (! File::exists($outputDirectory)) {
        File::makeDirectory($outputDirectory, 0755, true);
    }

    $ghostscriptTempDirectory = storage_path('app/filegrip-tmp/ghostscript');

    if (! File::exists($ghostscriptTempDirectory)) {
        File::makeDirectory($ghostscriptTempDirectory, 0755, true);
    }

    $inputPath = str_replace('\\', '/', $inputPath);
    $outputPath = str_replace('\\', '/', $outputPath);
    $ghostscriptTempDirectory = str_replace('\\', '/', $ghostscriptTempDirectory);

    $process = new Process(
        [
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
        ],
        $outputDirectory,
        [
            'TEMP' => $ghostscriptTempDirectory,
            'TMP' => $ghostscriptTempDirectory,
            'TMPDIR' => $ghostscriptTempDirectory,
            'GS_TMPDIR' => $ghostscriptTempDirectory,
        ]
    );

    $process->setTimeout(180);
    $process->run();

    if (! $process->isSuccessful()) {
        $error = trim($process->getErrorOutput() ?: $process->getOutput());

        throw new RuntimeException('PDF compression failed: ' . $error);
    }

    if (! File::exists($outputPath) || File::size($outputPath) === 0) {
        throw new RuntimeException('Compressed PDF was not created.');
    }
}
}