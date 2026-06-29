"use client";

/** @format */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  FileText,
  ImageIcon,
  Loader2,
  Package,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type PdfToImageUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type OutputFormat = "jpg" | "png" | "webp";

type FilePreview = {
  previewUrl: string | null;
  pageCount: number | null;
};

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
};

const OUTPUT_FORMATS: {
  value: OutputFormat;
  label: string;
  description: string;
  bestFor: string;
}[] = [
  {
    value: "jpg",
    label: "JPG",
    description: "Smaller files, great for sharing.",
    bestFor: "Best for documents",
  },
  {
    value: "png",
    label: "PNG",
    description: "Sharp quality with clean text.",
    bestFor: "Best for quality",
  },
  {
    value: "webp",
    label: "WEBP",
    description: "Modern format with strong compression.",
    bestFor: "Best for web",
  },
];

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

function getInitialOutputFormat(toolSlug: string): OutputFormat {
  if (toolSlug === "pdf-to-png") return "png";
  if (toolSlug === "pdf-to-webp") return "webp";

  return "jpg";
}

export default function PdfToImageUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: PdfToImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview>({
    previewUrl: null,
    pageCount: null,
  });
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(
    getInitialOutputFormat(toolSlug),
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<FileJobResponse | null>(null);
  const [error, setError] = useState("");
  const [limitModal, setLimitModal] = useState<LimitModalState>({
    isOpen: false,
    title: "",
    message: "",
    actionLabel: "",
    actionHref: "",
    variant: "compress",
  });

  const acceptedTypes = inputTypes
    ?.map((type) => `.${type.toLowerCase()}`)
    .join(",");

  const selectedFormat = useMemo(() => {
    return OUTPUT_FORMATS.find((format) => format.value === outputFormat);
  }, [outputFormat]);

  const outputFileLabel = useMemo(() => {
    if (!preview.pageCount) return `${outputFormat.toUpperCase()} images`;

    return `${preview.pageCount} ${outputFormat.toUpperCase()} ${
      preview.pageCount === 1 ? "image" : "images"
    }`;
  }, [outputFormat, preview.pageCount]);

  useEffect(() => {
    if (!job || isProcessing) return;

    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [job, isProcessing]);

  function closeLimitModal() {
    setLimitModal((current) => ({
      ...current,
      isOpen: false,
    }));
  }

  async function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, mmm... this PDF is too large.",
        message:
          "Your PDF is bigger than our maximum upload limit. Try our Compress PDF tool to reduce the file size, then come back and convert it to images.",
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("PDF to Image only accepts PDF files.");
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
    setIsPreviewing(false);
    setIsProcessing(false);
    setJob(null);
    setError("");
    setOutputFormat(getInitialOutputFormat(toolSlug));
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
          toolSlug: "pdf-to-image",
          files: [selectedFile],
          settings: {
            output_format: outputFormat,
          },
        }),
        wait(2600),
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
          <FileImage size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Upload PDF to convert images
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Convert every PDF page into JPG, PNG, or WEBP images. FileGrip packs
          all converted pages into one clean ZIP download.
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
          Max file size: {maxFileSizeMb ?? 25} MB · Output: ZIP
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="overflow-hidden rounded-[1.35rem] border border-[#E7E5E4] bg-[#FFF7ED] dark:border-white/10 dark:bg-[#F97316]/10 lg:sticky lg:top-24 lg:self-start">
              <div className="relative flex h-[280px] items-center justify-center sm:h-[320px] lg:h-[360px]">
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
                    className="h-full w-full object-contain p-3"
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
                  First page
                </div>

                <div className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-[#9A3412] shadow-lg ring-1 ring-[#FED7AA] dark:bg-[#111827]/90 dark:text-orange-200 dark:ring-[#F97316]/25">
                  → {outputFormat.toUpperCase()}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-start gap-4">
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] sm:flex dark:bg-[#F97316]/10">
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

                    <div className="rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/10">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-green-600/70 dark:text-green-300/60">
                        Download
                      </p>
                      <p className="mt-1 text-sm font-black text-green-700 dark:text-green-200">
                        ZIP file
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
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-sm font-black text-[#111827] dark:text-white">
                        Choose output image type
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                        FileGrip converts every page and packs the result into a
                        ZIP.
                      </p>
                    </div>

                    <div className="rounded-full bg-[#FFF7ED] px-3 py-1.5 text-xs font-black text-[#F97316] ring-1 ring-[#FDBA74]/70 dark:bg-[#F97316]/10 dark:ring-[#F97316]/30">
                      {outputFileLabel}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {OUTPUT_FORMATS.map((format) => {
                      const isActive = outputFormat === format.value;

                      return (
                        <button
                          key={format.value}
                          type="button"
                          onClick={() => setOutputFormat(format.value)}
                          disabled={isProcessing}
                          className={`group rounded-[1.25rem] border p-4 text-left transition ${
                            isActive
                              ? "border-[#F97316] bg-[#FFF7ED] text-[#111827] shadow-[0_14px_30px_rgba(249,115,22,0.12)] dark:bg-[#F97316]/10 dark:text-white"
                              : "border-[#E7E5E4] bg-white text-[#57534E] hover:-translate-y-0.5 hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.035] dark:text-white/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA] dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                              <ImageIcon size={19} />
                            </div>

                            {isActive && (
                              <CheckCircle2
                                size={19}
                                className="text-[#F97316]"
                              />
                            )}
                          </div>

                          <p className="mt-3 text-base font-black">
                            {format.label}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                            {format.description}
                          </p>

                          <div className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#9A3412] ring-1 ring-[#FED7AA] dark:bg-white/[0.05] dark:text-orange-200 dark:ring-[#F97316]/25">
                            {format.bestFor}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-[1.5rem] border border-green-200 bg-green-50 p-4 dark:border-green-500/20 dark:bg-green-500/10">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-green-700 ring-1 ring-green-200 dark:bg-white/[0.06] dark:text-green-300 dark:ring-green-500/20">
                        <Package size={21} />
                      </div>

                      <div>
                        <p className="text-sm font-black text-green-900 dark:text-green-100">
                          ZIP download preview
                        </p>
                        <p className="mt-1 text-xs font-bold leading-5 text-green-700 dark:text-green-300">
                          Your download will contain one{" "}
                          {selectedFormat?.label ?? outputFormat.toUpperCase()}{" "}
                          image for each PDF page, named in page order.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isProcessing && (
                <ToolProcessingPanel
                  title={`Converting PDF to ${outputFormat.toUpperCase()}`}
                  subtitle="FileGrip is rendering each PDF page as an image and packaging everything into a ZIP."
                />
              )}

              {job && (
                <div ref={resultRef}>
                  <ToolResultCard
                    job={job}
                    selectedFileSize={selectedFile.size}
                    downloadLabel={`Download ${outputFormat.toUpperCase()} ZIP`}
                    resetLabel="Convert another PDF"
                    onReset={resetUpload}
                  />
                </div>
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
                      Converting...
                    </>
                  ) : (
                    <>
                      <FileImage size={18} />
                      Convert PDF to {outputFormat.toUpperCase()} ZIP
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

      <ToolLimitModal
        isOpen={limitModal.isOpen}
        title={limitModal.title}
        message={limitModal.message}
        actionLabel={limitModal.actionLabel}
        actionHref={limitModal.actionHref}
        variant={limitModal.variant}
        onClose={closeLimitModal}
      />
    </div>
  );
}