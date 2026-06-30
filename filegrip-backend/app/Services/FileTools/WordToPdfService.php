<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Process\Process;
use App\Support\BinaryResolver;

class WordToPdfService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     engine: string
     * }
     */
    public function convert(string $inputPath, string $outputPath): array
    {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input document file missing.');
        }

        $outputDirectory = dirname($outputPath);

        if (! File::exists($outputDirectory)) {
            File::makeDirectory($outputDirectory, 0755, true);
        }

        $temporaryDirectory = $outputDirectory . DIRECTORY_SEPARATOR . 'libreoffice-temp';
        $profileDirectory = $outputDirectory . DIRECTORY_SEPARATOR . 'libreoffice-profile';

        if (File::exists($temporaryDirectory)) {
            File::deleteDirectory($temporaryDirectory);
        }

        if (File::exists($profileDirectory)) {
            File::deleteDirectory($profileDirectory);
        }

        File::makeDirectory($temporaryDirectory, 0755, true);
        File::makeDirectory($profileDirectory, 0755, true);

        $sofficePath = BinaryResolver::libreOffice();

        if (! $sofficePath) {
            throw new RuntimeException('LibreOffice is not installed or could not be found.');
        }

        $profileUrl = BinaryResolver::pathToFileUrl($profileDirectory);

        $process = new Process([
            $sofficePath,
            '--headless',
            '--invisible',
            '--nodefault',
            '--nofirststartwizard',
            '--nolockcheck',
            '--nologo',
            '-env:UserInstallation=' . $profileUrl,
            '--convert-to',
            'pdf:writer_pdf_Export',
            '--outdir',
            $temporaryDirectory,
            $inputPath,
        ]);

        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = trim($process->getErrorOutput() ?: $process->getOutput());

            $this->cleanup($temporaryDirectory, $profileDirectory);

            throw new RuntimeException(
                'Word to PDF conversion failed: ' . ($error !== '' ? $error : 'LibreOffice failed without an error message.')
            );
        }

        $createdPdf = $this->findCreatedPdf($temporaryDirectory);

        if (! $createdPdf) {
            $this->cleanup($temporaryDirectory, $profileDirectory);

            throw new RuntimeException('LibreOffice did not create a PDF file.');
        }

        File::move($createdPdf, $outputPath);

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            $this->cleanup($temporaryDirectory, $profileDirectory);

            throw new RuntimeException('PDF was not created.');
        }

        $this->cleanup($temporaryDirectory, $profileDirectory);

        return [
            'output_file_count' => 1,
            'input_file_count' => 1,
            'engine' => 'libreoffice',
        ];
    }

   

    private function findCreatedPdf(string $directory): ?string
    {
        $files = glob($directory . DIRECTORY_SEPARATOR . '*.pdf') ?: [];

        if (count($files) === 0) {
            return null;
        }

        usort($files, function (string $a, string $b) {
            return filemtime($b) <=> filemtime($a);
        });

        return $files[0];
    }

    private function cleanup(string $temporaryDirectory, string $profileDirectory): void
    {
        if (File::exists($temporaryDirectory)) {
            File::deleteDirectory($temporaryDirectory);
        }

        if (File::exists($profileDirectory)) {
            File::deleteDirectory($profileDirectory);
        }
    }
}