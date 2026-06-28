<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FileTools\ImageToPdfService;
use App\Services\FileTools\PdfSplitService;
use App\Models\DownloadToken;
use App\Models\FileJob;
use App\Models\FileJobFile;
use App\Models\Tool;
use App\Services\FileTools\PdfCompressService;
use App\Services\FileTools\PdfMergeService;
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
        PdfSplitService $pdfSplitService
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
    'jpg-to-pdf', 'png-to-pdf', 'image-to-pdf' => $this->processImageToPdf($request, $tool, $imageToPdfService),
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

        $imageToPdfService->convert($inputAbsolutePaths, $outputAbsolutePath);

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