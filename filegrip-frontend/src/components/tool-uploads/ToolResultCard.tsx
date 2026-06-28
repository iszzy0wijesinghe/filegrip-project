"use client";

/** @format */

import {
  CheckCircle2,
  Download,
  FileText,
  PartyPopper,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { FileJobResponse } from "../../lib/fileJobsApi";

type ToolResultCardProps = {
  job: FileJobResponse;
  selectedFileSize?: number;
  downloadLabel?: string;
  resetLabel?: string;
  onReset: () => void;
};

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 MB";

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getSavedLabel(job: FileJobResponse) {
  const savedPercent = Number(job.saved_percent ?? 0);

  if (savedPercent <= 0) {
    return "Already optimized";
  }

  return `${savedPercent.toFixed(1)}% smaller`;
}

export default function ToolResultCard({
  job,
  selectedFileSize,
  downloadLabel = "Download file",
  resetLabel = "Process another file",
  onReset,
}: ToolResultCardProps) {
  const isCompressResult = job.tool_slug === "compress-pdf";

  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#BBF7D0] bg-green-50 p-5 dark:border-green-500/20 dark:bg-green-500/10">
      <div className="relative">
        <div className="absolute right-0 top-0 hidden gap-1 text-[#22C55E] sm:flex">
          <Sparkles size={18} className="animate-pulse" />
          <PartyPopper size={22} className="animate-bounce" />
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#22C55E] text-white shadow-lg shadow-green-500/20">
            <CheckCircle2 size={25} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-green-900 dark:text-green-100">
              {job.was_compressed === false
                ? "Best version kept"
                : isCompressResult
                  ? "Hooray!"
                  : "Your file is ready"}
            </p>

            <p className="mt-1 text-sm font-bold leading-6 text-green-700 dark:text-green-300">
              {job.message || "File job created successfully."}
            </p>
          </div>
        </div>

        {isCompressResult && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 dark:bg-white/[0.06]">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-green-700/60 dark:text-green-200/50">
                Original
              </p>
              <p className="mt-1 text-lg font-black text-green-950 dark:text-green-100">
                {formatFileSize(job.input_size_bytes ?? selectedFileSize)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 dark:bg-white/[0.06]">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-green-700/60 dark:text-green-200/50">
                Final
              </p>
              <p className="mt-1 text-lg font-black text-green-950 dark:text-green-100">
                {formatFileSize(job.output_size_bytes)}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 dark:bg-white/[0.06]">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-green-700/60 dark:text-green-200/50">
                Saved
              </p>
              <p className="mt-1 text-lg font-black text-green-950 dark:text-green-100">
                {getSavedLabel(job)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          {job.download_url && (
            <a
              href={job.download_url}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
            >
              <Download size={17} />
              {downloadLabel}
            </a>
          )}

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-green-200 bg-white px-6 py-3 text-sm font-black text-green-800 transition hover:-translate-y-0.5 hover:border-[#F97316] hover:text-[#F97316] dark:border-green-500/20 dark:bg-white/[0.06] dark:text-green-100"
          >
            <RotateCcw size={16} />
            {resetLabel}
          </button>

          {!job.download_url && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-green-700 dark:bg-white/[0.06] dark:text-green-200">
              <FileText size={15} />
              Download is being prepared
            </div>
          )}
        </div>
      </div>
    </div>
  );
}