"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type PdfToWordUploadProps = {
  toolSlug?: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function PdfToWordUpload({
  toolSlug = "pdf-to-word",
  inputTypes,
  maxFileSizeMb = 25,
}: PdfToWordUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const acceptedTypes =
    inputTypes && inputTypes.length > 0
      ? inputTypes.map((type) => `.${type.toLowerCase()}`).join(",")
      : ".pdf,application/pdf";

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

  function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, this PDF is too large.",
        message: `"${file.name}" is bigger than our maximum upload limit. Compress the PDF first, then return here to convert it to Word.`,
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    if (!isPdfFile(file)) {
      setError("PDF to Word only accepts PDF files.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function clearFile() {
    setSelectedFile(null);
    setJob(null);
    setError("");
    setIsProcessing(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function processFile() {
    if (!selectedFile) {
      setError("Please choose a PDF file first.");
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
          settings: {},
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
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-6 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Upload size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Upload PDF file
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Convert a selectable-text PDF into an editable Word DOCX document.
          Best for digital PDFs. Scanned image PDFs will need OCR support later.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
        >
          <FileText size={18} />
          {selectedFile ? "Choose another PDF" : "Select PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          PDF supported · Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] dark:bg-[#F97316]/10">
                <FileText size={28} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">
                  {selectedFile.name}
                </p>

                <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-[#78716C] dark:text-white/45">
                  <span>PDF</span>
                  <span>•</span>
                  <span>{formatFileSize(selectedFile.size)}</span>
                </div>
              </div>
            </div>

            {!isProcessing && !job && (
              <button
                type="button"
                onClick={clearFile}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/60 dark:hover:border-red-500/40 dark:hover:text-red-300"
              >
                <X size={15} />
                Remove
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                <CheckCircle2 size={15} />
                Format
              </div>
              <p className="mt-2 text-sm font-black text-[#111827] dark:text-white">
                PDF to DOCX
              </p>
            </div>

            <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                <ShieldCheck size={15} />
                Private
              </div>
              <p className="mt-2 text-sm font-black text-[#111827] dark:text-white">
                Auto-expires
              </p>
            </div>

            <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                <FileText size={15} />
                Output
              </div>
              <p className="mt-2 text-sm font-black text-[#111827] dark:text-white">
                Editable Word
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/75 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
              Conversion note
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-[#78716C] dark:text-white/55">
              This first version extracts editable text from PDFs. Complex page
              layout, exact columns, and scanned image PDFs will be improved in a
              later OCR/layout upgrade.
            </p>
          </div>

          {isProcessing && (
            <ToolProcessingPanel
              title="Converting PDF to Word"
              subtitle="FileGrip is extracting readable PDF text and creating an editable DOCX file."
            />
          )}

          {job && (
            <div ref={resultRef}>
              <ToolResultCard
                job={job}
                downloadLabel="Download DOCX"
                resetLabel="Convert another PDF"
                onReset={clearFile}
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
                  <FileText size={18} />
                  Convert to Word
                </>
              )}
            </button>
          )}
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