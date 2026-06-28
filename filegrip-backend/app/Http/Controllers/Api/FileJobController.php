<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DownloadToken;
use App\Models\FileJob;
use App\Models\FileJobFile;
use App\Models\Tool;
use App\Services\FileTools\PdfMergeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class FileJobController extends Controller
{
    public function process(Request $request, string $slug, PdfMergeService $pdfMergeService): JsonResponse
    {
        $tool = Tool::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->first();

        if (! $tool) {
            return response()->json([
                'message' => 'Tool not found.',
            ], 404);
        }

        if ($tool->slug !== 'merge-pdf') {
            return response()->json([
                'message' => 'This tool API is coming next. Merge PDF is active first.',
            ], 422);
        }

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

    public function show(string $uuid): JsonResponse
    {
        $job = FileJob::query()
            ->where('uuid', $uuid)
            ->with('files')
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