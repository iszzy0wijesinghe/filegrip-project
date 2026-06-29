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

type WordToPdfUploadProps = {
  toolSlug: string;
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

function isSupportedDocument(file: File) {
  const name = file.name.toLowerCase();

  return (
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".odt") ||
    name.endsWith(".rtf")
  );
}

function getDocumentType(file: File) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) return "DOCX";
  if (name.endsWith(".doc")) return "DOC";
  if (name.endsWith(".odt")) return "ODT";
  if (name.endsWith(".rtf")) return "RTF";

  return "Document";
}

export default function WordToPdfUpload({
  inputTypes,
  maxFileSizeMb = 25,
}: WordToPdfUploadProps) {
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
      : ".doc,.docx,.odt,.rtf";

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
        title: "Hey Homie, this document is too large.",
        message:
          `"${file.name}" is bigger than our maximum upload limit. Try reducing the document size, removing heavy images, or splitting the document first.`,
        actionLabel: "Try PDF Tools",
        actionHref: "/tools",
        variant: "compress",
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    if (!isSupportedDocument(file)) {
      setError("Word to PDF only accepts DOC, DOCX, ODT, and RTF files.");

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
      setError("Please choose a Word document first.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setJob(null);

    try {
      const [result] = await Promise.all([
        createFileJob({
          toolSlug: "word-to-pdf",
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
          Upload Word document
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Convert DOC, DOCX, ODT, or RTF documents into a clean PDF while
          keeping layout and formatting as close as possible.
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
          {selectedFile ? "Choose another document" : "Select document"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          DOC, DOCX, ODT, RTF supported · Max file size: {maxFileSizeMb ?? 25} MB
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
                  <span>{getDocumentType(selectedFile)}</span>
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
                Word to PDF
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
                Clean PDF
              </p>
            </div>
          </div>

          {isProcessing && (
            <ToolProcessingPanel
              title="Converting Word to PDF"
              subtitle="FileGrip is using LibreOffice conversion to preserve your document layout."
            />
          )}

          {job && (
            <div ref={resultRef}>
              <ToolResultCard
                job={job}
                downloadLabel="Download PDF"
                resetLabel="Convert another document"
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
                  Convert to PDF
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