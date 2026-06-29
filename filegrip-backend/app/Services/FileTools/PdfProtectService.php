<?php

namespace App\Services\FileTools;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Process\Process;

class PdfProtectService
{
    /**
     * @return array{
     *     output_file_count: int,
     *     input_file_count: int,
     *     engine: string,
     *     encrypted: bool
     * }
     */
    public function protect(
        string $inputPath,
        string $outputPath,
        string $password,
        bool $allowPrinting = true,
        bool $allowCopying = false,
        bool $allowEditing = false
    ): array {
        if (! file_exists($inputPath)) {
            throw new RuntimeException('Input PDF file missing.');
        }

        $password = trim($password);

        if (strlen($password) < 6) {
            throw new RuntimeException('Password must be at least 6 characters.');
        }

        $this->ensureDirectory($outputPath);

        $qpdfPath = $this->qpdfPath();

        if (! $qpdfPath) {
            throw new RuntimeException('qpdf is not installed or could not be found.');
        }

        $ownerPassword = bin2hex(random_bytes(16));

        $process = new Process([
            $qpdfPath,
            '--encrypt',
            $password,
            $ownerPassword,
            '256',
            '--print=' . ($allowPrinting ? 'full' : 'none'),
            '--modify=' . ($allowEditing ? 'all' : 'none'),
            '--extract=' . ($allowCopying ? 'y' : 'n'),
            '--',
            $inputPath,
            $outputPath,
        ]);

        $process->setTimeout(300);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = trim($process->getErrorOutput() ?: $process->getOutput());

            throw new RuntimeException(
                'PDF protection failed: ' . ($error !== '' ? $error : 'qpdf failed without an error message.')
            );
        }

        if (! file_exists($outputPath) || filesize($outputPath) === 0) {
            throw new RuntimeException('Protected PDF was not created.');
        }

        return [
            'output_file_count' => 1,
            'input_file_count' => 1,
            'engine' => 'qpdf',
            'encrypted' => true,
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