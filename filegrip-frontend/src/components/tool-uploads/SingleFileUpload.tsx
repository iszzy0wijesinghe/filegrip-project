"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Upload, X } from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type SingleFileUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type FilePreview = {
  previewUrl: string | null;
  pageCount: number | null;
  isPdf: boolean;
  isImage: boolean;
};

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
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

function getToolAction(toolSlug: string) {
  const labels: Record<string, string> = {
    "compress-pdf": "Compress PDF",
    "split-pdf": "Split PDF",
    "rotate-pdf": "Rotate PDF",
    "delete-pdf-pages": "Delete Pages",
    "reorder-pdf-pages": "Reorder Pages",
    "protect-pdf": "Protect PDF",
    "pdf-to-jpg": "Convert to JPG",
    "pdf-to-word": "Convert to Word",
    "word-to-pdf": "Convert to PDF",
    "compress-image": "Compress Image",
    "convert-image": "Convert Image",
  };

  return labels[toolSlug] ?? "Process File";
}

function getUploadTitle(toolSlug: string) {
  const titles: Record<string, string> = {
    "compress-pdf": "Upload PDF to compress",
    "split-pdf": "Upload PDF to split",
    "rotate-pdf": "Upload PDF to rotate",
    "delete-pdf-pages": "Upload PDF to edit pages",
    "reorder-pdf-pages": "Upload PDF to reorder",
    "protect-pdf": "Upload PDF to protect",
    "pdf-to-jpg": "Upload PDF to convert",
    "pdf-to-word": "Upload PDF to convert",
    "word-to-pdf": "Upload Word document",
    "compress-image": "Upload image to compress",
    "convert-image": "Upload image to convert",
  };

  return titles[toolSlug] ?? "Upload your file";
}

function getProcessingLabel(toolSlug: string) {
  const labels: Record<string, string> = {
    "compress-pdf": "Compressing your PDF",
    "split-pdf": "Splitting your PDF",
    "rotate-pdf": "Rotating your PDF",
    "delete-pdf-pages": "Editing your PDF pages",
    "reorder-pdf-pages": "Reordering your PDF pages",
    "protect-pdf": "Protecting your PDF",
    "pdf-to-jpg": "Converting PDF to JPG",
    "pdf-to-word": "Converting PDF to Word",
    "word-to-pdf": "Converting Word to PDF",
    "compress-image": "Compressing your image",
    "convert-image": "Converting your image",
  };

  return labels[toolSlug] ?? "Processing your file";
}

function getDownloadLabel(toolSlug: string) {
  const labels: Record<string, string> = {
    "compress-pdf": "Download compressed PDF",
    "split-pdf": "Download split file",
    "rotate-pdf": "Download rotated PDF",
    "delete-pdf-pages": "Download edited PDF",
    "reorder-pdf-pages": "Download reordered PDF",
    "protect-pdf": "Download protected PDF",
    "pdf-to-jpg": "Download JPG files",
    "pdf-to-word": "Download Word file",
    "word-to-pdf": "Download PDF",
    "compress-image": "Download compressed image",
    "convert-image": "Download converted image",
  };

  return labels[toolSlug] ?? "Download file";
}

async function createFilePreview(file: File): Promise<FilePreview> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const isImage = file.type.startsWith("image/");

  if (isImage) {
    return {
      previewUrl: URL.createObjectURL(file),
      pageCount: null,
      isPdf,
      isImage,
    };
  }

  if (!isPdf) {
    return {
      previewUrl: null,
      pageCount: null,
      isPdf,
      isImage,
    };
  }

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
        isPdf,
        isImage,
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
      isPdf,
      isImage,
    };
  } catch {
    return {
      previewUrl: null,
      pageCount: null,
      isPdf,
      isImage,
    };
  }
}

export default function SingleFileUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: SingleFileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview>({
    previewUrl: null,
    pageCount: null,
    isPdf: false,
    isImage: false,
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [password, setPassword] = useState("");
  const [pageRange, setPageRange] = useState("");
  const [rotation, setRotation] = useState("90");
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

  const actionLabel = getToolAction(toolSlug);

  useEffect(() => {
    return () => {
      if (preview.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    };
  }, [preview.previewUrl]);

  function closeLimitModal() {
    setLimitModal((current) => ({
      ...current,
      isOpen: false,
    }));
  }

  function showLargeFileModal(file: File) {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    const isImage = file.type.startsWith("image/");

    if (toolSlug === "compress-pdf") {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, this PDF is too large.",
        message:
          "This file is bigger than our current upload limit for Compress PDF. Split it into smaller parts first, then compress each part.",
        actionLabel: "Split PDF",
        actionHref: "/tools/split-pdf",
        variant: "split",
      });
      return;
    }

    if (isPdf) {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, mmm... this file is too large.",
        message:
          "Your file is bigger than our maximum upload limit. Try our Compress PDF tool to reduce the file size, then come back and retry.",
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });
      return;
    }

    if (isImage) {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, this image is too large.",
        message:
          "Your image is bigger than our maximum upload limit. Try compressing the image first, then come back and retry.",
        actionLabel: "Compress Image",
        actionHref: "/tools/compress-image",
        variant: "compress",
      });
      return;
    }

    setLimitModal({
      isOpen: true,
      title: "Hey Homie, this file is too large.",
      message:
        "Your file is bigger than our maximum upload limit. Try reducing the file size, then upload it again.",
      actionLabel: "Try Compress PDF",
      actionHref: "/tools/compress-pdf",
      variant: "compress",
    });
  }

  async function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      showLargeFileModal(file);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    if (preview.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.previewUrl);
    }

    setSelectedFile(file);
    setPreview({
      previewUrl: null,
      pageCount: null,
      isPdf: false,
      isImage: false,
    });
    setIsPreviewing(true);

    const nextPreview = await createFilePreview(file);

    setPreview(nextPreview);
    setIsPreviewing(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetUpload() {
    if (preview.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.previewUrl);
    }

    setSelectedFile(null);
    setPreview({
      previewUrl: null,
      pageCount: null,
      isPdf: false,
      isImage: false,
    });
    setJob(null);
    setError("");
    setPassword("");
    setPageRange("");
    setRotation("90");
  }

  async function processFile() {
    if (!selectedFile) {
      setError("Please choose a file first.");
      return;
    }

    if (toolSlug === "protect-pdf" && password.trim().length < 4) {
      setError("Please enter a password with at least 4 characters.");
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
            password: toolSlug === "protect-pdf" ? password : undefined,
            page_range:
              toolSlug === "split-pdf" || toolSlug === "delete-pdf-pages"
                ? pageRange
                : undefined,
            rotation: toolSlug === "rotate-pdf" ? rotation : undefined,
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
          <Upload size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          {getUploadTitle(toolSlug)}
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#78716C] dark:text-white/60">
          Select one file. FileGrip will preview it, process it securely, and
          prepare your download.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes || undefined}
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
        >
          <FileText size={18} />
          {selectedFile ? "Replace file" : "Select file"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="overflow-hidden rounded-[1.35rem] border border-[#E7E5E4] bg-[#FFF7ED] dark:border-white/10 dark:bg-[#F97316]/10">
              <div className="relative flex aspect-[4/5] items-center justify-center">
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
                  Original
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
                        Type
                      </p>
                      <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                        {preview.isPdf
                          ? "PDF"
                          : preview.isImage
                            ? "Image"
                            : "Document"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetUpload}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-[#78716C] transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/55"
                  aria-label="Remove file"
                >
                  <X size={17} />
                </button>
              </div>

              {toolSlug === "protect-pdf" && (
                <div className="mt-5">
                  <label className="text-sm font-black text-[#111827] dark:text-white">
                    PDF password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-bold text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  />
                </div>
              )}

              {(toolSlug === "split-pdf" || toolSlug === "delete-pdf-pages") && (
                <div className="mt-5">
                  <label className="text-sm font-black text-[#111827] dark:text-white">
                    Page range
                  </label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(event) => setPageRange(event.target.value)}
                    placeholder="Example: 1-3, 5, 8-10"
                    className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-bold text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  />
                </div>
              )}

              {toolSlug === "rotate-pdf" && (
                <div className="mt-5">
                  <label className="text-sm font-black text-[#111827] dark:text-white">
                    Rotation
                  </label>
                  <select
                    value={rotation}
                    onChange={(event) => setRotation(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-bold text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  >
                    <option value="90">90 degrees</option>
                    <option value="180">180 degrees</option>
                    <option value="270">270 degrees</option>
                  </select>
                </div>
              )}

              {isProcessing && (
                <ToolProcessingPanel title={getProcessingLabel(toolSlug)} />
              )}

              {job && (
                <ToolResultCard
                  job={job}
                  selectedFileSize={selectedFile.size}
                  downloadLabel={getDownloadLabel(toolSlug)}
                  resetLabel={
                    toolSlug === "compress-pdf"
                      ? "Compress another PDF"
                      : "Process another file"
                  }
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileText size={18} />
                      {actionLabel}
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