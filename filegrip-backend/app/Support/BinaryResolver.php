<?php

namespace App\Support;

use Symfony\Component\Process\ExecutableFinder;

class BinaryResolver
{
    public static function ghostscript(): ?string
    {
        return self::resolve(
            envPath: env('GS_BINARY'),
            candidates: match (PHP_OS_FAMILY) {
                'Windows' => [
                    'C:/Program Files/gs/*/bin/gswin64c.exe',
                    'C:/Program Files/gs/*/bin/gswin32c.exe',
                    'C:/Program Files/Ghostscript/*/bin/gswin64c.exe',
                    'C:/Program Files/Ghostscript/*/bin/gswin32c.exe',
                    'D:/Tools/gs*/bin/gswin64c.exe',
                    'D:/Tools/gs*/bin/gswin32c.exe',
                    'D:/Tools/Ghostscript/*/bin/gswin64c.exe',
                    'D:/Tools/Ghostscript/*/bin/gswin32c.exe',
                ],
                'Darwin' => [
                    '/opt/homebrew/bin/gs',
                    '/usr/local/bin/gs',
                    '/opt/local/bin/gs',
                ],
                default => [
                    '/usr/bin/gs',
                    '/usr/local/bin/gs',
                    '/snap/bin/gs',
                ],
            },
            executableNames: PHP_OS_FAMILY === 'Windows'
                ? ['gswin64c.exe', 'gswin64c', 'gswin32c.exe', 'gswin32c', 'gs.exe', 'gs']
                : ['gs']
        );
    }

    public static function qpdf(): ?string
    {
        return self::resolve(
            envPath: env('QPDF_BINARY'),
            candidates: match (PHP_OS_FAMILY) {
                'Windows' => [
                    'C:/Program Files/qpdf*/bin/qpdf.exe',
                    'C:/Program Files/QPDF*/bin/qpdf.exe',
                    'D:/Tools/qpdf/bin/qpdf.exe',
                    'D:/Tools/qpdf*/bin/qpdf.exe',
                    'D:/Tools/QPDF*/bin/qpdf.exe',
                ],
                'Darwin' => [
                    '/opt/homebrew/bin/qpdf',
                    '/usr/local/bin/qpdf',
                    '/opt/local/bin/qpdf',
                ],
                default => [
                    '/usr/bin/qpdf',
                    '/usr/local/bin/qpdf',
                    '/snap/bin/qpdf',
                ],
            },
            executableNames: PHP_OS_FAMILY === 'Windows'
                ? ['qpdf.exe', 'qpdf']
                : ['qpdf']
        );
    }

    public static function libreOffice(): ?string
    {
        return self::resolve(
            envPath: env('LIBREOFFICE_BINARY'),
            candidates: match (PHP_OS_FAMILY) {
                'Windows' => [
                    'C:/Program Files/LibreOffice/program/soffice.exe',
                    'C:/Program Files (x86)/LibreOffice/program/soffice.exe',
                    'D:/Tools/LibreOffice/program/soffice.exe',
                    'D:/Tools/LibreOffice*/program/soffice.exe',
                ],
                'Darwin' => [
                    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
                    '/opt/homebrew/bin/soffice',
                    '/opt/homebrew/bin/libreoffice',
                    '/usr/local/bin/soffice',
                    '/usr/local/bin/libreoffice',
                    '/opt/local/bin/soffice',
                    '/opt/local/bin/libreoffice',
                ],
                default => [
                    '/usr/bin/libreoffice',
                    '/usr/bin/soffice',
                    '/usr/local/bin/libreoffice',
                    '/usr/local/bin/soffice',
                    '/snap/bin/libreoffice',
                ],
            },
            executableNames: PHP_OS_FAMILY === 'Windows'
                ? ['soffice.exe', 'soffice', 'libreoffice.exe', 'libreoffice']
                : ['libreoffice', 'soffice']
        );
    }

    public static function pathToFileUrl(string $path): string
    {
        $path = str_replace('\\', '/', $path);

        $segments = array_map('rawurlencode', explode('/', $path));
        $encodedPath = implode('/', $segments);
        $encodedPath = str_replace('%3A', ':', $encodedPath);

        if (preg_match('/^[A-Za-z]:\//', $path) === 1) {
            return 'file:///' . $encodedPath;
        }

        return 'file://' . (str_starts_with($encodedPath, '/') ? '' : '/') . $encodedPath;
    }

    private static function resolve(?string $envPath, array $candidates, array $executableNames): ?string
    {
        foreach (self::normalizeCandidates([$envPath]) as $path) {
            if (self::isUsableExecutable($path)) {
                return $path;
            }
        }

        foreach (self::normalizeCandidates($candidates) as $path) {
            if (self::isUsableExecutable($path)) {
                return $path;
            }
        }

        $finder = new ExecutableFinder();

        foreach ($executableNames as $name) {
            $path = $finder->find($name);

            if ($path && self::isUsableExecutable($path)) {
                return self::normalizePath($path);
            }
        }

        return null;
    }

    private static function normalizeCandidates(array $candidates): array
    {
        $paths = [];

        foreach ($candidates as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }

            $candidate = trim($candidate, " \t\n\r\0\x0B\"'");

            if ($candidate === '') {
                continue;
            }

            $expanded = str_contains($candidate, '*')
                ? (glob($candidate, GLOB_NOSORT) ?: [])
                : [$candidate];

            foreach ($expanded as $path) {
                $paths[] = self::normalizePath($path);
            }
        }

        return array_values(array_unique($paths));
    }

    private static function normalizePath(string $path): string
    {
        return str_replace('\\', '/', $path);
    }

    private static function isUsableExecutable(string $path): bool
    {
        if (PHP_OS_FAMILY === 'Windows') {
            return is_file($path);
        }

        return is_file($path) && is_executable($path);
    }
}

