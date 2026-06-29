"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Loader2,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";

type RotatePdfUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type FilePreview = {
  previewUrl: string | null;
  pageCount: number | null;
};

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 MB";

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function createPdfPreview(file: File): Promise<FilePreview> {
  try {
    const pdfjsLib = await import("pdfjs-dist");

    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: buffer,
    }).promise;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.55 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return {
        previewUrl: null,
        pageCount: pdf.numPages,
      };
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    return {
      previewUrl: canvas.toDataURL("image/png"),
      pageCount: pdf.numPages,
    };
  } catch {
    return {
      previewUrl: null,
      pageCount: null,
    };
  }
}

export default function RotatePdfUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: RotatePdfUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview>({
    previewUrl: null,
    pageCount: null,
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [rotation, setRotation] = useState("90");
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<FileJobResponse | null>(null);
  const [error, setError] = useState("");

  const acceptedTypes = inputTypes
    ?.map((type) => `.${type.toLowerCase()}`)
    .join(",");

  useEffect(() => {
    return () => {
      if (preview.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    };
  }, [preview.previewUrl]);

  async function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      setError(`"${file.name}" is larger than ${maxFileSizeMb} MB.`);
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Rotate PDF only accepts PDF files.");
      return;
    }

    setSelectedFile(file);
    setPreview({
      previewUrl: null,
      pageCount: null,
    });
    setIsPreviewing(true);
    setJob(null);

    const nextPreview = await createPdfPreview(file);

    setPreview(nextPreview);
    setIsPreviewing(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetUpload() {
    setSelectedFile(null);
    setPreview({
      previewUrl: null,
      pageCount: null,
    });
    setRotation("90");
    setIsProcessing(false);
    setJob(null);
    setError("");
  }

  async function processFile() {
    if (!selectedFile) {
      setError("Please choose a PDF first.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setJob(null);

    try {
      const [result] = await Promise.all([
        createFileJob({
          toolSlug,
          files: [selectedFile],
          settings: {
            rotation: Number(rotation),
          },
        }),
        wait(2400),
      ]);

      setJob(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-8 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <RotateCw size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Upload PDF to rotate
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#78716C] dark:text-white/60">
          Rotate every page in your PDF and download a clean corrected copy.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes || ".pdf"}
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
        >
          <Upload size={18} />
          {selectedFile ? "Replace PDF" : "Select PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="overflow-hidden rounded-[1.35rem] border border-[#E7E5E4] bg-[#FFF7ED] dark:border-white/10 dark:bg-[#F97316]/10 lg:sticky lg:top-24 lg:self-start">
              <div className="relative flex h-[280px] items-center justify-center sm:h-[320px] lg:h-[340px]">
                {isPreviewing ? (
                  <div className="flex flex-col items-center text-[#F97316]">
                    <Loader2 size={28} className="animate-spin" />
                    <span className="mt-2 text-xs font-black">
                      Creating preview
                    </span>
                  </div>
                ) : preview.previewUrl ? (
                  <img
                    src={preview.previewUrl}
                    alt={`${selectedFile.name} preview`}
                    className="h-full w-full object-contain p-3 transition duration-300"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center text-[#F97316]">
                    <FileText size={42} />
                    <span className="mt-3 text-xs font-black">
                      Preview unavailable
                    </span>
                  </div>
                )}

                <div className="absolute left-3 top-3 rounded-full bg-[#F97316] px-3 py-1 text-xs font-black text-white shadow-lg">
                  Preview
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] dark:bg-[#F97316]/10">
                  <FileText size={26} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-[#111827] dark:text-white">
                    {selectedFile.name}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                        File size
                      </p>
                      <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                        Pages
                      </p>
                      <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                        {preview.pageCount ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                        Rotation
                      </p>
                      <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                        {rotation}°
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetUpload}
                  disabled={isProcessing}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-[#78716C] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white/55"
                  aria-label="Remove file"
                >
                  <X size={17} />
                </button>
              </div>

              {!job && (
                <div className="mt-5">
                  <p className="text-sm font-black text-[#111827] dark:text-white">
                    Choose rotation
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {["90", "180", "270"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRotation(value)}
                        disabled={isProcessing}
                        className={`rounded-[1.25rem] border p-4 text-left transition ${
                          rotation === value
                            ? "border-[#F97316] bg-[#FFF7ED] text-[#111827] dark:bg-[#F97316]/10 dark:text-white"
                            : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.035] dark:text-white/60"
                        }`}
                      >
                        <RotateCw size={20} className="text-[#F97316]" />
                        <p className="mt-3 text-sm font-black">
                          Rotate {value}°
                        </p>
                        <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                          Apply {value}° rotation to every page.
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isProcessing && (
                <ToolProcessingPanel
                  title="Rotating your PDF"
                  subtitle="FileGrip is rotating every page and preparing your corrected PDF download."
                />
              )}

              {job && (
                <ToolResultCard
                  job={job}
                  selectedFileSize={selectedFile.size}
                  downloadLabel="Download rotated PDF"
                  resetLabel="Rotate another PDF"
                  onReset={resetUpload}
                />
              )}

              {!job && (
                <button
                  type="button"
                  onClick={processFile}
                  disabled={isProcessing}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Rotating...
                    </>
                  ) : (
                    <>
                      <RotateCw size={18} />
                      Rotate PDF
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}