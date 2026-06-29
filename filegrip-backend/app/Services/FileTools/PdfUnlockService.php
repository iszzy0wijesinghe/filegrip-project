<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Process\Process;

class PdfUnlockService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     engine: string,
     *     unlocked: bool
     * }
     */
    public function unlock(
        string $inputPath,
        string $outputPath,
        string $password,
        bool $confirmedPermission
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        if (! $confirmedPermission) {
            throw new RuntimeException('You must confirm you have permission to unlock this PDF.');
        }

        $password = trim($password);

        if ($password === '') {
            throw new RuntimeException('Please enter the current PDF password.');
        }

        $this->ensureDirectory($outputPath);

        $qpdfPath = $this->qpdfPath();

        if (! $qpdfPath) {
            throw new RuntimeException('qpdf is not installed or could not be found.');
        }

        $process = new Process([
            $qpdfPath,
            '--password=' . $password,
            '--decrypt',
            $inputPath,
            $outputPath,
        ]);

        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = trim($process->getErrorOutput() ?: $process->getOutput());

            throw new RuntimeException(
                'PDF unlock failed. Please check the password. ' . ($error !== '' ? $error : '')
            );
        }

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Unlocked PDF was not created.');
        }

        return [
            'output_file_count' => 1,
            'input_file_count' => 1,
            'engine' => 'qpdf',
            'unlocked' => true,
        ];
    }

    private function ensureDirectory(string $outputPath): void
    {
        $directory = dirname($outputPath);

        if (! File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }
    }

    private function qpdfPath(): ?string
    {
        $paths = [
            '/opt/homebrew/bin/qpdf',
            '/usr/local/bin/qpdf',
            '/usr/bin/qpdf',
        ];

        foreach ($paths as $path) {
            if (is_executable($path)) {
                return $path;
            }
        }

        $process = new Process(['which', 'qpdf']);
        $process->run();

        if ($process->isSuccessful()) {
            $path = trim($process->getOutput());

            if ($path !== '' && is_executable($path)) {
                return $path;
            }
        }

        return null;
    }
}