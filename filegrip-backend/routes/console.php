<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Support\BinaryResolver;
use Symfony\Component\Console\Command\Command;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('filegrip:tools', function () {
    $tools = [
        'Ghostscript' => BinaryResolver::ghostscript(),
        'qpdf' => BinaryResolver::qpdf(),
        'LibreOffice' => BinaryResolver::libreOffice(),
    ];

    $missing = false;

    foreach ($tools as $name => $path) {
        if ($path) {
            $this->info($name . ': ' . $path);
        } else {
            $missing = true;
            $this->error($name . ': not found');
        }
    }

    return $missing ? Command::FAILURE : Command::SUCCESS;
})->purpose('Check FileGrip external tool binaries');