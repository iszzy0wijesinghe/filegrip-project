<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FileTools\ImageToPdfService;
use App\Services\FileTools\PdfSplitService;
use App\Services\FileTools\PdfRotateService;
use App\Services\FileTools\PdfDeletePagesService;
use App\Services\FileTools\PdfToImageService;
use App\Services\FileTools\WordToPdfService;
use App\Services\FileTools\PdfToWordService;
use App\Services\FileTools\ImageCompressService;
use App\Services\FileTools\ImageResizeService;
use App\Services\FileTools\ImageConvertService;
use App\Services\FileTools\ImageCropService;
use App\Services\FileTools\ImageRotateService;
use App\Services\FileTools\PdfProtectService;
use App\Services\FileTools\PdfUnlockService;
use App\Services\FileTools\PdfWatermarkService;
use App\Services\FileTools\PdfSignService;
use App\Services\FileTools\PdfRedactService;

use App\Models\DownloadToken;
use App\Models\FileJob;
use App\Models\FileJobFile;
use App\Models\Tool;
use App\Services\FileTools\PdfCompressService;
use App\Services\FileTools\PdfMergeService;
use App\Services\FileTools\PdfReorderPagesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class FileJobController extends Controller
{
    public function process(
        Request $request,
        string $slug,
        PdfMergeService $pdfMergeService,
        PdfCompressService $pdfCompressService,
        ImageToPdfService $imageToPdfService,
        PdfSplitService $pdfSplitService,
        PdfRotateService $pdfRotateService,
        PdfDeletePagesService $pdfDeletePagesService,
        PdfReorderPagesService $pdfReorderPagesService,
        PdfToImageService $pdfToImageService,
        WordToPdfService $wordToPdfService,
        PdfToWordService $pdfToWordService,
        ImageCompressService $imageCompressService,
        ImageResizeService $imageResizeService,
        ImageConvertService $imageConvertService,
        ImageCropService $imageCropService,
        ImageRotateService $imageRotateService,
        PdfProtectService $pdfProtectService,
PdfUnlockService $pdfUnlockService,
PdfWatermarkService $pdfWatermarkService,
PdfSignService $pdfSignService,
PdfRedactService $pdfRedactService
    ): JsonResponse {
        $tool = Tool::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if (! $tool) {
            return response()->json([
                'message' => 'Tool not found.',
            ], 404);
        }

        return match ($tool->slug) {
    'merge-pdf' => $this->processMergePdf($request, $tool, $pdfMergeService),
    'compress-pdf' => $this->processCompressPdf($request, $tool, $pdfCompressService),
    'split-pdf' => $this->processSplitPdf($request, $tool, $pdfSplitService),
    'rotate-pdf' => $this->processRotatePdf($request, $tool, $pdfRotateService),
    'delete-pdf-pages' => $this->processDeletePdfPages($request, $tool, $pdfDeletePagesService),
    'reorder-pdf-pages' => $this->processReorderPdfPages($request, $tool, $pdfReorderPagesService),
    'jpg-to-pdf', 'png-to-pdf', 'image-to-pdf' => $this->processImageToPdf($request, $tool, $imageToPdfService),
'pdf-to-image', 'pdf-to-jpg', 'pdf-to-png', 'pdf-to-webp' => $this->processPdfToImage($request, $tool, $pdfToImageService),
    'word-to-pdf' => $this->processWordToPdf($request, $tool, $wordToPdfService),
    'pdf-to-word' => $this->processPdfToWord($request, $tool, $pdfToWordService),
    'compress-image' => $this->processCompressImage($request, $tool, $imageCompressService),
'resize-image' => $this->processResizeImage($request, $tool, $imageResizeService),
'convert-image' => $this->processConvertImage($request, $tool, $imageConvertService),
'crop-image' => $this->processCropImage($request, $tool, $imageCropService),
'rotate-image' => $this->processRotateImage($request, $tool, $imageRotateService),
'protect-pdf' => $this->processProtectPdf($request, $tool, $pdfProtectService),
'unlock-pdf' => $this->processUnlockPdf($request, $tool, $pdfUnlockService),
'add-watermark' => $this->processAddWatermark($request, $tool, $pdfWatermarkService),
'sign-pdf' => $this->processSignPdf($request, $tool, $pdfSignService),
'redact-pdf' => $this->processRedactPdf($request, $tool, $pdfRedactService),
    default => response()->json([
        'message' => 'This tool API is coming next.',
    ], 422),
};
    }

    private function processMergePdf(
        Request $request,
        Tool $tool,
        PdfMergeService $pdfMergeService
    ): JsonResponse {
        $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

        $request->validate([
            'files' => ['required', 'array', 'min:2'],
            'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
            'settings' => ['nullable', 'string'],
        ]);

        $uploadedFiles = $request->file('files');

        $uuid = (string) Str::uuid();

        $job = FileJob::query()->create([
            'uuid' => $uuid,
            'job_uuid' => $uuid,
            'tool_id' => $tool->id,
            'status' => 'processing',
            'priority' => 0,
            'input_file_count' => count($uploadedFiles),
            'output_file_count' => 0,
            'total_input_size_bytes' => 0,
            'total_output_size_bytes' => 0,
            'settings' => $this->decodeSettings($request->input('settings')),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
            'started_at' => now(),
            'expires_at' => now()->addHour(),
        ]);

        try {
            $inputAbsolutePaths = [];
            $totalInputSize = 0;

            foreach ($uploadedFiles as $index => $file) {
                $extension = strtolower($file->getClientOriginalExtension() ?: 'pdf');
                $storedName = str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)
                    . '-' . Str::random(16)
                    . '.' . $extension;

                $relativePath = $file->storeAs(
                    "file_jobs/{$uuid}/input",
                    $storedName,
                    'local'
                );

                $absolutePath = Storage::disk('local')->path($relativePath);
                $sizeBytes = (int) $file->getSize();
                $totalInputSize += $sizeBytes;

                FileJobFile::query()->create([
                    'file_job_id' => $job->id,
                    'file_role' => 'input',
                    'original_name' => $file->getClientOriginalName(),
                    'stored_name' => $storedName,
                    'mime_type' => $file->getClientMimeType() ?: 'application/pdf',
                    'extension' => $extension,
                    'size_bytes' => $sizeBytes,
                    'storage_disk' => 'local',
                    'storage_path' => $relativePath,
                    'checksum_sha256' => hash_file('sha256', $absolutePath),
                    'is_deleted' => false,
                ]);

                $inputAbsolutePaths[] = $absolutePath;
            }

            $outputStoredName = 'filegrip-merged-' . now()->format('Ymd-His') . '.pdf';
            $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
            $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

            Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

            $pdfMergeService->merge($inputAbsolutePaths, $outputAbsolutePath);

            $outputSize = filesize($outputAbsolutePath) ?: 0;

            $outputFile = FileJobFile::query()->create([
                'file_job_id' => $job->id,
                'file_role' => 'output',
                'original_name' => 'filegrip-merged.pdf',
                'stored_name' => $outputStoredName,
                'mime_type' => 'application/pdf',
                'extension' => 'pdf',
                'size_bytes' => $outputSize,
                'storage_disk' => 'local',
                'storage_path' => $outputRelativePath,
                'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
                'is_deleted' => false,
            ]);

            $plainToken = Str::random(72);

            DownloadToken::query()->create([
                'file_job_file_id' => $outputFile->id,
                'token_hash' => hash('sha256', $plainToken),
                'download_count' => 0,
                'max_downloads' => 5,
                'expires_at' => now()->addHour(),
                'created_at' => now(),
            ]);

            $job->update([
                'status' => 'completed',
                'output_file_count' => 1,
                'total_input_size_bytes' => $totalInputSize,
                'total_output_size_bytes' => $outputSize,
                'finished_at' => now(),
            ]);

            return response()->json([
                'uuid' => $job->uuid,
                'status' => 'completed',
                'tool_slug' => $tool->slug,
                'message' => 'Your PDF files were merged successfully.',
                'download_url' => url("/api/v1/downloads/{$plainToken}"),
                'error_message' => null,
            ]);
        } catch (Throwable $e) {
            $job->update([
                'status' => 'failed',
                'error_code' => 'merge_pdf_failed',
                'error_message' => $e->getMessage(),
                'finished_at' => now(),
            ]);

            return response()->json([
                'uuid' => $job->uuid,
                'status' => 'failed',
                'tool_slug' => $tool->slug,
                'message' => 'File processing failed.',
                'download_url' => null,
                'error_message' => $e->getMessage(),
            ], 500);
        }
    }

    private function processCompressPdf(
        Request $request,
        Tool $tool,
        PdfCompressService $pdfCompressService
    ): JsonResponse {
        $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

        $request->validate([
            'files' => ['required', 'array', 'size:1'],
            'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
            'settings' => ['nullable', 'string'],
        ]);

        $uploadedFile = $request->file('files')[0];

        $uuid = (string) Str::uuid();

        $job = FileJob::query()->create([
            'uuid' => $uuid,
            'job_uuid' => $uuid,
            'tool_id' => $tool->id,
            'status' => 'processing',
            'priority' => 0,
            'input_file_count' => 1,
            'output_file_count' => 0,
            'total_input_size_bytes' => 0,
            'total_output_size_bytes' => 0,
            'settings' => $this->decodeSettings($request->input('settings')),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
            'started_at' => now(),
            'expires_at' => now()->addHour(),
        ]);

        try {
            $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
            $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

            $inputRelativePath = $uploadedFile->storeAs(
                "file_jobs/{$uuid}/input",
                $inputStoredName,
                'local'
            );

            $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
            $inputSize = (int) $uploadedFile->getSize();

            FileJobFile::query()->create([
                'file_job_id' => $job->id,
                'file_role' => 'input',
                'original_name' => $uploadedFile->getClientOriginalName(),
                'stored_name' => $inputStoredName,
                'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
                'extension' => $extension,
                'size_bytes' => $inputSize,
                'storage_disk' => 'local',
                'storage_path' => $inputRelativePath,
                'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
                'is_deleted' => false,
            ]);

            $outputStoredName = 'filegrip-compressed-' . now()->format('Ymd-His') . '.pdf';
            $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
            $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

            Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

$compressionResult = $pdfCompressService->compress(
    $inputAbsolutePath,
    $outputAbsolutePath
);

            $outputSize = file_exists($outputAbsolutePath)
                ? (int) filesize($outputAbsolutePath)
                : 0;

            $outputFile = FileJobFile::query()->create([
                'file_job_id' => $job->id,
                'file_role' => 'output',
                'original_name' => 'filegrip-compressed.pdf',
                'stored_name' => $outputStoredName,
                'mime_type' => 'application/pdf',
                'extension' => 'pdf',
                'size_bytes' => $outputSize,
                'storage_disk' => 'local',
                'storage_path' => $outputRelativePath,
                'checksum_sha256' => file_exists($outputAbsolutePath)
                    ? hash_file('sha256', $outputAbsolutePath)
                    : null,
                'is_deleted' => false,
            ]);

            $plainToken = Str::random(72);

            DownloadToken::query()->create([
                'file_job_file_id' => $outputFile->id,
                'token_hash' => hash('sha256', $plainToken),
                'download_count' => 0,
                'max_downloads' => 5,
                'expires_at' => now()->addHour(),
                'created_at' => now(),
            ]);

            $job->update([
                'status' => 'completed',
                'output_file_count' => 1,
                'total_input_size_bytes' => $inputSize,
                'total_output_size_bytes' => $outputSize,
                'finished_at' => now(),
            ]);

 $message = $compressionResult['was_compressed']
    ? 'Hooray! Your PDF was compressed successfully.'
    : 'Your PDF was already optimized. FileGrip kept the best version.';

return response()->json([
    'uuid' => $job->uuid,
    'status' => 'completed',
    'tool_slug' => $tool->slug,
    'message' => $message,
    'download_url' => url("/api/v1/downloads/{$plainToken}"),
    'input_size_bytes' => $compressionResult['input_size_bytes'],
    'output_size_bytes' => $compressionResult['output_size_bytes'],
    'saved_bytes' => $compressionResult['saved_bytes'],
    'saved_percent' => $compressionResult['saved_percent'],
    'was_compressed' => $compressionResult['was_compressed'],
    'error_message' => null,
]);
        } catch (Throwable $e) {
            $job->update([
                'status' => 'failed',
                'error_code' => 'compress_pdf_failed',
                'error_message' => $e->getMessage(),
                'finished_at' => now(),
            ]);

            return response()->json([
                'uuid' => $job->uuid,
                'status' => 'failed',
                'tool_slug' => $tool->slug,
                'message' => 'PDF compression failed.',
                'download_url' => null,
                'error_message' => $e->getMessage(),
            ], 500);
        }
    }


    private function processImageToPdf(
    Request $request,
    Tool $tool,
    ImageToPdfService $imageToPdfService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'min:1'],
        'files.*' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $uploadedFiles = $request->file('files');
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => count($uploadedFiles),
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $this->decodeSettings($request->input('settings')),
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $inputAbsolutePaths = [];
        $totalInputSize = 0;

        foreach ($uploadedFiles as $index => $file) {
            $extension = strtolower($file->getClientOriginalExtension() ?: 'jpg');
            $storedName = str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)
                . '-' . Str::random(16)
                . '.' . $extension;

            $relativePath = $file->storeAs(
                "file_jobs/{$uuid}/input",
                $storedName,
                'local'
            );

            $absolutePath = Storage::disk('local')->path($relativePath);
            $sizeBytes = (int) $file->getSize();
            $totalInputSize += $sizeBytes;

            FileJobFile::query()->create([
                'file_job_id' => $job->id,
                'file_role' => 'input',
                'original_name' => $file->getClientOriginalName(),
                'stored_name' => $storedName,
                'mime_type' => $file->getClientMimeType() ?: 'image/jpeg',
                'extension' => $extension,
                'size_bytes' => $sizeBytes,
                'storage_disk' => 'local',
                'storage_path' => $relativePath,
                'checksum_sha256' => hash_file('sha256', $absolutePath),
                'is_deleted' => false,
            ]);

            $inputAbsolutePaths[] = $absolutePath;
        }

        $outputStoredName = 'filegrip-images-' . now()->format('Ymd-His') . '.pdf';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $conversionResult = $imageToPdfService->convert($inputAbsolutePaths, $outputAbsolutePath);

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-images.pdf',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => 1,
            'total_input_size_bytes' => $totalInputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

     return response()->json([
    'uuid' => $job->uuid,
    'status' => 'completed',
    'tool_slug' => $tool->slug,
    'message' => 'Your images were converted to PDF successfully.',
    'download_url' => url("/api/v1/downloads/{$plainToken}"),
    'input_size_bytes' => $totalInputSize,
    'output_size_bytes' => $outputSize,
    'output_file_count' => $conversionResult['output_file_count'],
    'page_count' => $conversionResult['page_count'],
    'input_file_count' => $conversionResult['input_file_count'],
    'error_message' => null,
]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'image_to_pdf_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'Image to PDF conversion failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}


private function processSplitPdf(
    Request $request,
    Tool $tool,
    PdfSplitService $pdfSplitService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $this->decodeSettings($request->input('settings')),
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $partsDirectoryRelative = "file_jobs/{$uuid}/output/parts";
        $partsDirectoryAbsolute = Storage::disk('local')->path($partsDirectoryRelative);

        $zipStoredName = 'filegrip-split-' . now()->format('Ymd-His') . '.zip';
        $zipRelativePath = "file_jobs/{$uuid}/output/{$zipStoredName}";
        $zipAbsolutePath = Storage::disk('local')->path($zipRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");
        Storage::disk('local')->makeDirectory($partsDirectoryRelative);

        $splitResult = $pdfSplitService->splitToZip(
            $inputAbsolutePath,
            $partsDirectoryAbsolute,
            $zipAbsolutePath,
            $this->decodeSettings($request->input('settings'))
        );

        $zipSize = filesize($zipAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-split.zip',
            'stored_name' => $zipStoredName,
            'mime_type' => 'application/zip',
            'extension' => 'zip',
            'size_bytes' => $zipSize,
            'storage_disk' => 'local',
            'storage_path' => $zipRelativePath,
            'checksum_sha256' => hash_file('sha256', $zipAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => $splitResult['output_file_count'],
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $zipSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => 'Your PDF was split successfully.',
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $zipSize,
            'output_file_count' => $splitResult['output_file_count'],
            'download_type' => 'zip',
            'ranges' => $splitResult['ranges'],
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'split_pdf_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'PDF split failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}

private function processRotatePdf(
    Request $request,
    Tool $tool,
    PdfRotateService $pdfRotateService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $settings = $this->decodeSettings($request->input('settings'));
    $rotation = (int) ($settings['rotation'] ?? 90);

    if (! in_array($rotation, [90, 180, 270], true)) {
        return response()->json([
            'message' => 'Invalid rotation value.',
        ], 422);
    }

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputStoredName = 'filegrip-rotated-' . now()->format('Ymd-His') . '.pdf';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $pdfRotateService->rotate($inputAbsolutePath, $outputAbsolutePath, $rotation);

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-rotated.pdf',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => 1,
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => "Your PDF was rotated {$rotation}° successfully.",
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'rotation' => $rotation,
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'rotate_pdf_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'PDF rotation failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}

private function processDeletePdfPages(
    Request $request,
    Tool $tool,
    PdfDeletePagesService $pdfDeletePagesService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $settings = $this->decodeSettings($request->input('settings'));
    $deletePagesText = trim((string) ($settings['delete_pages'] ?? ''));

    if ($deletePagesText === '') {
        return response()->json([
            'message' => 'Please select at least one page to delete.',
        ], 422);
    }

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputStoredName = 'filegrip-cleaned-' . now()->format('Ymd-His') . '.pdf';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $deleteResult = $pdfDeletePagesService->deletePages(
            $inputAbsolutePath,
            $outputAbsolutePath,
            $deletePagesText
        );

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-cleaned.pdf',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => 1,
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => 'Selected pages were deleted successfully.',
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'page_count' => $deleteResult['page_count'],
            'deleted_pages' => $deleteResult['deleted_pages'],
            'deleted_pages_text' => $deleteResult['deleted_pages_text'],
            'kept_pages' => $deleteResult['kept_pages'],
            'kept_pages_text' => $deleteResult['kept_pages_text'],
            'deleted_count' => $deleteResult['deleted_count'],
            'kept_count' => $deleteResult['kept_count'],
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'delete_pdf_pages_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'PDF page deletion failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}

private function processReorderPdfPages(
    Request $request,
    Tool $tool,
    PdfReorderPagesService $pdfReorderPagesService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $settings = $this->decodeSettings($request->input('settings'));
    $pageOrderText = trim((string) ($settings['page_order'] ?? ''));

    if ($pageOrderText === '') {
        return response()->json([
            'message' => 'Please reorder at least one page first.',
        ], 422);
    }

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputStoredName = 'filegrip-reordered-' . now()->format('Ymd-His') . '.pdf';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $reorderResult = $pdfReorderPagesService->reorder(
            $inputAbsolutePath,
            $outputAbsolutePath,
            $pageOrderText
        );

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-reordered.pdf',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => 1,
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => 'Your PDF pages were reordered successfully.',
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'page_count' => $reorderResult['page_count'],
            'page_order' => $reorderResult['page_order'],
            'page_order_text' => $reorderResult['page_order_text'],
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'reorder_pdf_pages_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'PDF page reorder failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}

private function processPdfToImage(
    Request $request,
    Tool $tool,
    PdfToImageService $pdfToImageService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $settings = $this->decodeSettings($request->input('settings'));

    $outputFormat = strtolower((string) ($settings['output_format'] ?? 'jpg'));

    if (! in_array($outputFormat, ['jpg', 'png', 'webp'], true)) {
        return response()->json([
            'message' => 'Please choose a valid output image format.',
        ], 422);
    }

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputFolderRelativePath = "file_jobs/{$uuid}/output/images";
        $outputFolderAbsolutePath = Storage::disk('local')->path($outputFolderRelativePath);

        $zipStoredName = 'filegrip-pdf-to-' . $outputFormat . '-' . now()->format('Ymd-His') . '.zip';
        $zipRelativePath = "file_jobs/{$uuid}/output/{$zipStoredName}";
        $zipAbsolutePath = Storage::disk('local')->path($zipRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");
        Storage::disk('local')->makeDirectory($outputFolderRelativePath);

        $conversionResult = $pdfToImageService->convertToZip(
            $inputAbsolutePath,
            $outputFolderAbsolutePath,
            $zipAbsolutePath,
            $outputFormat
        );

        $outputSize = filesize($zipAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-pdf-to-' . $outputFormat . '.zip',
            'stored_name' => $zipStoredName,
            'mime_type' => 'application/zip',
            'extension' => 'zip',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $zipRelativePath,
            'checksum_sha256' => hash_file('sha256', $zipAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => $conversionResult['output_file_count'],
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => 'Your PDF was converted to images successfully.',
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'output_file_count' => $conversionResult['output_file_count'],
            'download_type' => 'zip',
            'output_format' => $outputFormat,
            'page_count' => $conversionResult['page_count'],
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'pdf_to_image_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'PDF to image conversion failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}


private function processWordToPdf(
    Request $request,
    Tool $tool,
    WordToPdfService $wordToPdfService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:doc,docx,odt,rtf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $settings = $this->decodeSettings($request->input('settings'));

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'docx');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/octet-stream',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputStoredName = 'filegrip-word-to-pdf-' . now()->format('Ymd-His') . '.pdf';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $conversionResult = $wordToPdfService->convert(
            $inputAbsolutePath,
            $outputAbsolutePath
        );

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-word-to-pdf.pdf',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => $conversionResult['output_file_count'],
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => 'Your Word document was converted to PDF successfully.',
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'output_file_count' => $conversionResult['output_file_count'],
            'input_file_count' => $conversionResult['input_file_count'],
            'engine' => $conversionResult['engine'],
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'word_to_pdf_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'Word to PDF conversion failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}


private function processPdfToWord(
    Request $request,
    Tool $tool,
    PdfToWordService $pdfToWordService
): JsonResponse {
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    $settings = $this->decodeSettings($request->input('settings'));

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'pdf');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/pdf',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputStoredName = 'filegrip-pdf-to-word-' . now()->format('Ymd-His') . '.docx';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $conversionResult = $pdfToWordService->convert(
            $inputAbsolutePath,
            $outputAbsolutePath
        );

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => 'filegrip-pdf-to-word.docx',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'extension' => 'docx',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => $conversionResult['output_file_count'],
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => 'Your PDF was converted to Word successfully.',
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'output_file_count' => $conversionResult['output_file_count'],
            'input_file_count' => $conversionResult['input_file_count'],
            'page_count' => $conversionResult['page_count'],
            'engine' => $conversionResult['engine'],
            'error_message' => null,
        ]);
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => 'pdf_to_word_failed',
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => 'PDF to Word conversion failed.',
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}


private function processCompressImage(
    Request $request,
    Tool $tool,
    ImageCompressService $imageCompressService
): JsonResponse {
    $settings = $this->validateSingleImageRequest($request, $tool);

    $quality = (int) ($settings['quality'] ?? 78);
    $outputFormat = strtolower((string) ($settings['output_format'] ?? 'webp'));

    return $this->processSingleImageTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-compressed-image',
        outputFormat: $outputFormat,
        successMessage: 'Your image was compressed successfully.',
        failureMessage: 'Image compression failed.',
        failureCode: 'compress_image_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $imageCompressService,
            $outputFormat,
            $quality
        ) {
            return $imageCompressService->compress(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $outputFormat,
                $quality
            );
        }
    );
}

private function processResizeImage(
    Request $request,
    Tool $tool,
    ImageResizeService $imageResizeService
): JsonResponse {
    $settings = $this->validateSingleImageRequest($request, $tool);

    $width = (int) ($settings['width'] ?? 0);
    $height = (int) ($settings['height'] ?? 0);
    $outputFormat = strtolower((string) ($settings['output_format'] ?? 'webp'));
    $quality = (int) ($settings['quality'] ?? 90);

    if ($width < 1 || $height < 1) {
        return response()->json([
            'message' => 'Please enter a valid width and height.',
        ], 422);
    }

    if ($width > 12000 || $height > 12000) {
        return response()->json([
            'message' => 'Resize dimensions are too large. Please use 12000px or smaller.',
        ], 422);
    }

    return $this->processSingleImageTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-resized-image',
        outputFormat: $outputFormat,
        successMessage: 'Your image was resized successfully.',
        failureMessage: 'Image resizing failed.',
        failureCode: 'resize_image_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $imageResizeService,
            $width,
            $height,
            $outputFormat,
            $quality
        ) {
            return $imageResizeService->resize(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $width,
                $height,
                $outputFormat,
                $quality
            );
        }
    );
}

private function processConvertImage(
    Request $request,
    Tool $tool,
    ImageConvertService $imageConvertService
): JsonResponse {
    $settings = $this->validateSingleImageRequest($request, $tool);

    $outputFormat = strtolower((string) ($settings['output_format'] ?? 'webp'));
    $quality = (int) ($settings['quality'] ?? 88);

    return $this->processSingleImageTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-converted-image',
        outputFormat: $outputFormat,
        successMessage: 'Your image was converted successfully.',
        failureMessage: 'Image conversion failed.',
        failureCode: 'convert_image_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $imageConvertService,
            $outputFormat,
            $quality
        ) {
            return $imageConvertService->convert(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $outputFormat,
                $quality
            );
        }
    );
}

private function processCropImage(
    Request $request,
    Tool $tool,
    ImageCropService $imageCropService
): JsonResponse {
    $settings = $this->validateSingleImageRequest($request, $tool);

    $cropX = (int) ($settings['crop_x'] ?? 0);
    $cropY = (int) ($settings['crop_y'] ?? 0);
    $cropWidth = (int) ($settings['crop_width'] ?? 0);
    $cropHeight = (int) ($settings['crop_height'] ?? 0);
    $outputFormat = strtolower((string) ($settings['output_format'] ?? 'webp'));
    $quality = (int) ($settings['quality'] ?? 90);

    if ($cropWidth < 1 || $cropHeight < 1) {
        return response()->json([
            'message' => 'Please select a valid crop area.',
        ], 422);
    }

    return $this->processSingleImageTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-cropped-image',
        outputFormat: $outputFormat,
        successMessage: 'Your image was cropped successfully.',
        failureMessage: 'Image cropping failed.',
        failureCode: 'crop_image_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $imageCropService,
            $cropX,
            $cropY,
            $cropWidth,
            $cropHeight,
            $outputFormat,
            $quality
        ) {
            return $imageCropService->crop(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $cropX,
                $cropY,
                $cropWidth,
                $cropHeight,
                $outputFormat,
                $quality
            );
        }
    );
}

private function processRotateImage(
    Request $request,
    Tool $tool,
    ImageRotateService $imageRotateService
): JsonResponse {
    $settings = $this->validateSingleImageRequest($request, $tool);

    $rotation = (int) ($settings['rotation'] ?? 90);
    $outputFormat = strtolower((string) ($settings['output_format'] ?? 'webp'));
    $quality = (int) ($settings['quality'] ?? 90);

    if (! in_array($rotation, [90, 180, 270], true)) {
        return response()->json([
            'message' => 'Rotation must be 90, 180, or 270 degrees.',
        ], 422);
    }

    return $this->processSingleImageTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-rotated-image',
        outputFormat: $outputFormat,
        successMessage: 'Your image was rotated successfully.',
        failureMessage: 'Image rotation failed.',
        failureCode: 'rotate_image_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $imageRotateService,
            $rotation,
            $outputFormat,
            $quality
        ) {
            return $imageRotateService->rotate(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $rotation,
                $outputFormat,
                $quality
            );
        }
    );
}

/**
 * @return array<string, mixed>
 */
private function validateSingleImageRequest(Request $request, Tool $tool): array
{
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    return $this->decodeSettings($request->input('settings'));
}

/**
 * @param callable(string, string): array<string, mixed> $processor
 */
private function processSingleImageTool(
    Request $request,
    Tool $tool,
    string $outputPrefix,
    string $outputFormat,
    string $successMessage,
    string $failureMessage,
    string $failureCode,
    callable $processor
): JsonResponse {
    $outputFormat = $this->normalizeImageOutputFormat($outputFormat);
    $settings = $this->decodeSettings($request->input('settings'));

    $uploadedFile = $request->file('files')[0];
    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $extension = strtolower($uploadedFile->getClientOriginalExtension() ?: 'jpg');
        $inputStoredName = 'input-' . Str::random(16) . '.' . $extension;

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => $uploadedFile->getClientMimeType() ?: 'application/octet-stream',
            'extension' => $extension,
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $outputStoredName = $outputPrefix . '-' . now()->format('Ymd-His') . '.' . $outputFormat;
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $processingResult = $processor($inputAbsolutePath, $outputAbsolutePath);

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => $outputPrefix . '.' . $outputFormat,
            'stored_name' => $outputStoredName,
            'mime_type' => $this->imageMimeType($outputFormat),
            'extension' => $outputFormat,
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => (int) ($processingResult['output_file_count'] ?? 1),
            'total_input_size_bytes' => $inputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json(array_merge([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => $successMessage,
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $inputSize,
            'output_size_bytes' => $outputSize,
            'output_file_count' => (int) ($processingResult['output_file_count'] ?? 1),
            'input_file_count' => (int) ($processingResult['input_file_count'] ?? 1),
            'download_type' => 'image',
            'output_format' => $outputFormat,
            'error_message' => null,
        ], $processingResult));
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => $failureCode,
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => $failureMessage,
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}

private function normalizeImageOutputFormat(string $format): string
{
    $format = strtolower(trim($format));

    if ($format === 'jpeg') {
        return 'jpg';
    }

    if (! in_array($format, ['jpg', 'png', 'webp'], true)) {
        return 'webp';
    }

    return $format;
}

private function imageMimeType(string $format): string
{
    return match ($this->normalizeImageOutputFormat($format)) {
        'jpg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => 'application/octet-stream',
    };
}


private function processProtectPdf(
    Request $request,
    Tool $tool,
    PdfProtectService $pdfProtectService
): JsonResponse {
    $settings = $this->validateSinglePdfRequest($request, $tool);

    $password = (string) ($settings['password'] ?? '');
    $allowPrinting = (bool) ($settings['allow_printing'] ?? true);
    $allowCopying = (bool) ($settings['allow_copying'] ?? false);
    $allowEditing = (bool) ($settings['allow_editing'] ?? false);

    return $this->processSinglePdfSecurityTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-protected-pdf',
        successMessage: 'Your PDF was protected successfully.',
        failureMessage: 'PDF protection failed.',
        failureCode: 'protect_pdf_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $pdfProtectService,
            $password,
            $allowPrinting,
            $allowCopying,
            $allowEditing
        ) {
            return $pdfProtectService->protect(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $password,
                $allowPrinting,
                $allowCopying,
                $allowEditing
            );
        }
    );
}

private function processUnlockPdf(
    Request $request,
    Tool $tool,
    PdfUnlockService $pdfUnlockService
): JsonResponse {
    $settings = $this->validateSinglePdfRequest($request, $tool);

    $password = (string) ($settings['password'] ?? '');
    $confirmedPermission = (bool) ($settings['confirmed_permission'] ?? false);

    return $this->processSinglePdfSecurityTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-unlocked-pdf',
        successMessage: 'Your PDF was unlocked successfully.',
        failureMessage: 'PDF unlock failed.',
        failureCode: 'unlock_pdf_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $pdfUnlockService,
            $password,
            $confirmedPermission
        ) {
            return $pdfUnlockService->unlock(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $password,
                $confirmedPermission
            );
        }
    );
}

private function processAddWatermark(
    Request $request,
    Tool $tool,
    PdfWatermarkService $pdfWatermarkService
): JsonResponse {
    $settings = $this->validateSinglePdfRequest($request, $tool);

    $watermarkText = (string) ($settings['watermark_text'] ?? 'CONFIDENTIAL');
    $fontSize = (int) ($settings['font_size'] ?? 42);
    $opacity = (int) ($settings['opacity'] ?? 28);
    $rotation = (int) ($settings['rotation'] ?? -35);
    $position = (string) ($settings['position'] ?? 'center');
    $repeatWatermark = (bool) ($settings['repeat_watermark'] ?? false);
    $pageRange = (string) ($settings['page_range'] ?? 'all');

    return $this->processSinglePdfSecurityTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-watermarked-pdf',
        successMessage: 'Your watermark was added successfully.',
        failureMessage: 'PDF watermarking failed.',
        failureCode: 'watermark_pdf_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $pdfWatermarkService,
            $watermarkText,
            $fontSize,
            $opacity,
            $rotation,
            $position,
            $repeatWatermark,
            $pageRange
        ) {
            return $pdfWatermarkService->addWatermark(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $watermarkText,
                $fontSize,
                $opacity,
                $rotation,
                $position,
                $repeatWatermark,
                $pageRange
            );
        }
    );
}

private function processSignPdf(
    Request $request,
    Tool $tool,
    PdfSignService $pdfSignService
): JsonResponse {
    $settings = $this->decodeSettings($request->input('settings'));
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'min:1', 'max:2'],
        'files.0' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'files.1' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        'settings' => ['nullable', 'string'],
    ]);

    $signatureMode = (string) ($settings['signature_mode'] ?? 'draw');
    $signatureValue = (string) ($settings['signature_value'] ?? '');
    $positionX = (float) ($settings['signature_position_x'] ?? 52);
    $positionY = (float) ($settings['signature_position_y'] ?? 72);
    $signatureSize = (int) ($settings['signature_size'] ?? 34);
    $pageRange = (string) ($settings['page_range'] ?? '1');

    return $this->processSinglePdfSecurityTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-signed-pdf',
        successMessage: 'Your PDF was signed successfully.',
        failureMessage: 'PDF signing failed.',
        failureCode: 'sign_pdf_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath, ?string $extraAbsolutePath = null) use (
            $pdfSignService,
            $signatureMode,
            $signatureValue,
            $positionX,
            $positionY,
            $signatureSize,
            $pageRange
        ) {
            return $pdfSignService->sign(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $signatureMode,
                $signatureValue,
                $positionX,
                $positionY,
                $signatureSize,
                $pageRange,
                $extraAbsolutePath
            );
        },
        allowSecondFile: true
    );
}

private function processRedactPdf(
    Request $request,
    Tool $tool,
    PdfRedactService $pdfRedactService
): JsonResponse {
    $settings = $this->validateSinglePdfRequest($request, $tool);

    $pageRange = (string) ($settings['page_range'] ?? '1');
    $redactionColor = (string) ($settings['redaction_color'] ?? 'black');
    $boxes = is_array($settings['redaction_boxes'] ?? null)
        ? $settings['redaction_boxes']
        : [];
    $confirmedPermanent = (bool) ($settings['confirmed_permanent_redaction'] ?? false);

    return $this->processSinglePdfSecurityTool(
        request: $request,
        tool: $tool,
        outputPrefix: 'filegrip-redacted-pdf',
        successMessage: 'Your PDF was redacted successfully.',
        failureMessage: 'PDF redaction failed.',
        failureCode: 'redact_pdf_failed',
        processor: function (string $inputAbsolutePath, string $outputAbsolutePath) use (
            $pdfRedactService,
            $boxes,
            $pageRange,
            $redactionColor,
            $confirmedPermanent
        ) {
            return $pdfRedactService->redact(
                $inputAbsolutePath,
                $outputAbsolutePath,
                $boxes,
                $pageRange,
                $redactionColor,
                $confirmedPermanent
            );
        }
    );
}



/**
 * @return array<string, mixed>
 */
private function validateSinglePdfRequest(Request $request, Tool $tool): array
{
    $maxKb = ((int) ($tool->max_file_size_mb ?? 25)) * 1024;

    $request->validate([
        'files' => ['required', 'array', 'size:1'],
        'files.*' => ['required', 'file', 'mimes:pdf', 'max:' . $maxKb],
        'settings' => ['nullable', 'string'],
    ]);

    return $this->decodeSettings($request->input('settings'));
}

/**
 * @param callable(string, string, ?string=): array<string, mixed> $processor
 */
private function processSinglePdfSecurityTool(
    Request $request,
    Tool $tool,
    string $outputPrefix,
    string $successMessage,
    string $failureMessage,
    string $failureCode,
    callable $processor,
    bool $allowSecondFile = false
): JsonResponse {
    $settings = $this->decodeSettings($request->input('settings'));
    $uploadedFiles = $request->file('files');

    if (! is_array($uploadedFiles) || count($uploadedFiles) < 1) {
        return response()->json([
            'message' => 'Please upload a PDF file.',
        ], 422);
    }

    $uploadedFile = $uploadedFiles[0];
    $extraUploadedFile = $allowSecondFile && isset($uploadedFiles[1])
        ? $uploadedFiles[1]
        : null;

    $uuid = (string) Str::uuid();

    $job = FileJob::query()->create([
        'uuid' => $uuid,
        'job_uuid' => $uuid,
        'tool_id' => $tool->id,
        'status' => 'processing',
        'priority' => 0,
        'input_file_count' => $extraUploadedFile ? 2 : 1,
        'output_file_count' => 0,
        'total_input_size_bytes' => 0,
        'total_output_size_bytes' => 0,
        'settings' => $settings,
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 500),
        'started_at' => now(),
        'expires_at' => now()->addHour(),
    ]);

    try {
        $inputStoredName = 'input-' . Str::random(16) . '.pdf';

        $inputRelativePath = $uploadedFile->storeAs(
            "file_jobs/{$uuid}/input",
            $inputStoredName,
            'local'
        );

        $inputAbsolutePath = Storage::disk('local')->path($inputRelativePath);
        $inputSize = (int) $uploadedFile->getSize();

        FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'input',
            'original_name' => $uploadedFile->getClientOriginalName(),
            'stored_name' => $inputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $inputSize,
            'storage_disk' => 'local',
            'storage_path' => $inputRelativePath,
            'checksum_sha256' => hash_file('sha256', $inputAbsolutePath),
            'is_deleted' => false,
        ]);

        $extraAbsolutePath = null;
        $totalInputSize = $inputSize;

        if ($extraUploadedFile) {
            $extraExtension = strtolower($extraUploadedFile->getClientOriginalExtension() ?: 'png');
            $extraStoredName = 'signature-' . Str::random(16) . '.' . $extraExtension;

            $extraRelativePath = $extraUploadedFile->storeAs(
                "file_jobs/{$uuid}/input",
                $extraStoredName,
                'local'
            );

            $extraAbsolutePath = Storage::disk('local')->path($extraRelativePath);
            $extraSize = (int) $extraUploadedFile->getSize();
            $totalInputSize += $extraSize;

            FileJobFile::query()->create([
                'file_job_id' => $job->id,
                'file_role' => 'input',
                'original_name' => $extraUploadedFile->getClientOriginalName(),
                'stored_name' => $extraStoredName,
                'mime_type' => $extraUploadedFile->getClientMimeType() ?: 'application/octet-stream',
                'extension' => $extraExtension,
                'size_bytes' => $extraSize,
                'storage_disk' => 'local',
                'storage_path' => $extraRelativePath,
                'checksum_sha256' => hash_file('sha256', $extraAbsolutePath),
                'is_deleted' => false,
            ]);
        }

        $outputStoredName = $outputPrefix . '-' . now()->format('Ymd-His') . '.pdf';
        $outputRelativePath = "file_jobs/{$uuid}/output/{$outputStoredName}";
        $outputAbsolutePath = Storage::disk('local')->path($outputRelativePath);

        Storage::disk('local')->makeDirectory("file_jobs/{$uuid}/output");

        $processingResult = $processor(
            $inputAbsolutePath,
            $outputAbsolutePath,
            $extraAbsolutePath
        );

        $outputSize = filesize($outputAbsolutePath) ?: 0;

        $outputFile = FileJobFile::query()->create([
            'file_job_id' => $job->id,
            'file_role' => 'output',
            'original_name' => $outputPrefix . '.pdf',
            'stored_name' => $outputStoredName,
            'mime_type' => 'application/pdf',
            'extension' => 'pdf',
            'size_bytes' => $outputSize,
            'storage_disk' => 'local',
            'storage_path' => $outputRelativePath,
            'checksum_sha256' => hash_file('sha256', $outputAbsolutePath),
            'is_deleted' => false,
        ]);

        $plainToken = Str::random(72);

        DownloadToken::query()->create([
            'file_job_file_id' => $outputFile->id,
            'token_hash' => hash('sha256', $plainToken),
            'download_count' => 0,
            'max_downloads' => 5,
            'expires_at' => now()->addHour(),
            'created_at' => now(),
        ]);

        $job->update([
            'status' => 'completed',
            'output_file_count' => (int) ($processingResult['output_file_count'] ?? 1),
            'total_input_size_bytes' => $totalInputSize,
            'total_output_size_bytes' => $outputSize,
            'finished_at' => now(),
        ]);

        return response()->json(array_merge([
            'uuid' => $job->uuid,
            'status' => 'completed',
            'tool_slug' => $tool->slug,
            'message' => $successMessage,
            'download_url' => url("/api/v1/downloads/{$plainToken}"),
            'input_size_bytes' => $totalInputSize,
            'output_size_bytes' => $outputSize,
            'output_file_count' => (int) ($processingResult['output_file_count'] ?? 1),
            'input_file_count' => $extraUploadedFile ? 2 : 1,
            'download_type' => 'pdf',
            'error_message' => null,
        ], $processingResult));
    } catch (Throwable $e) {
        $job->update([
            'status' => 'failed',
            'error_code' => $failureCode,
            'error_message' => $e->getMessage(),
            'finished_at' => now(),
        ]);

        return response()->json([
            'uuid' => $job->uuid,
            'status' => 'failed',
            'tool_slug' => $tool->slug,
            'message' => $failureMessage,
            'download_url' => null,
            'error_message' => $e->getMessage(),
        ], 500);
    }
}

    public function show(string $uuid): JsonResponse
    {
        $job = FileJob::query()
            ->where('uuid', $uuid)
            ->with(['files', 'tool'])
            ->first();

        if (! $job) {
            return response()->json([
                'message' => 'File job not found.',
            ], 404);
        }

        $downloadUrl = null;

        if ($job->status === 'completed') {
            $outputFile = $job->files
                ->where('file_role', 'output')
                ->where('is_deleted', false)
                ->first();

            if ($outputFile) {
                $plainToken = Str::random(72);

                DownloadToken::query()->create([
                    'file_job_file_id' => $outputFile->id,
                    'token_hash' => hash('sha256', $plainToken),
                    'download_count' => 0,
                    'max_downloads' => 5,
                    'expires_at' => now()->addHour(),
                    'created_at' => now(),
                ]);

                $downloadUrl = url("/api/v1/downloads/{$plainToken}");
            }
        }

        return response()->json([
            'uuid' => $job->uuid,
            'status' => $job->status,
            'tool_slug' => $job->tool?->slug,
            'message' => $this->statusMessage($job->status),
            'download_url' => $downloadUrl,
            'error_message' => $job->error_message,
        ]);
    }

    public function download(string $token)
    {
        $tokenHash = hash('sha256', $token);

        $downloadToken = DownloadToken::query()
            ->where('token_hash', $tokenHash)
            ->where('expires_at', '>', now())
            ->first();

        if (! $downloadToken) {
            abort(404, 'Download link expired or invalid.');
        }

        if ($downloadToken->download_count >= $downloadToken->max_downloads) {
            abort(403, 'Download limit reached.');
        }

        $file = FileJobFile::query()->find($downloadToken->file_job_file_id);

        if (! $file || $file->is_deleted) {
            abort(404, 'File not found.');
        }

        if (! Storage::disk($file->storage_disk)->exists($file->storage_path)) {
            abort(404, 'File missing from storage.');
        }

        $downloadToken->increment('download_count');

        return response()->download(
            Storage::disk($file->storage_disk)->path($file->storage_path),
            $file->original_name ?: 'filegrip-output.pdf',
            [
                'Content-Type' => $file->mime_type ?: 'application/octet-stream',
            ]
        );
    }

    private function decodeSettings(?string $settings): array
    {
        if (! $settings) {
            return [];
        }

        $decoded = json_decode($settings, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function statusMessage(string $status): string
    {
        return match ($status) {
            'completed' => 'Your file is ready.',
            'processing' => 'Your file is still processing.',
            'failed' => 'File processing failed.',
            'expired' => 'This file job has expired.',
            default => 'File job status updated.',
        };
    }
}