"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  ShieldCheck,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type UnlockPdfUploadProps = {
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

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function UnlockPdfUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: UnlockPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOwnership, setConfirmOwnership] = useState(false);
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
    setLimitModal((current) => ({ ...current, isOpen: false }));
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
        message: `"${file.name}" is bigger than our current upload limit. Compress it first, then return to unlock it.`,
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!isPdf(file)) {
      setError("Unlock PDF only accepts PDF files.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setSelectedFile(file);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    setSelectedFile(null);
    setPassword("");
    setShowPassword(false);
    setConfirmOwnership(false);
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  function validate() {
    if (!selectedFile) return "Please choose a PDF first.";
    if (password.length < 1) return "Please enter the current PDF password.";
    if (!confirmOwnership) {
      return "Please confirm that you own this PDF or have permission to unlock it.";
    }

    return "";
  }

  async function unlockPdf() {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!selectedFile) return;

    setIsProcessing(true);
    setError("");
    setJob(null);

    try {
      const [result] = await Promise.all([
        createFileJob({
          toolSlug,
          files: [selectedFile],
          settings: {
            password,
            confirmed_permission: confirmOwnership,
          },
        }),
        wait(2200),
      ]);

      setJob(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-6 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Unlock size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Unlock PDF
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Remove password protection from a PDF when you know the correct
          password and have permission to unlock it.
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
          <Upload size={18} />
          {selectedFile ? "Choose another PDF" : "Select locked PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          PDF supported · Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] dark:bg-[#F97316]/10">
                  <FileText size={28} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#111827] dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#78716C] dark:text-white/45">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>

              {!isProcessing && !job && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/60"
                >
                  <X size={15} />
                  Remove
                </button>
              )}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED]/75 p-5 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 text-[#F97316]" size={24} />
                <div>
                  <p className="text-sm font-black text-[#111827] dark:text-white">
                    Permission required
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/55">
                    FileGrip only unlocks PDFs when you provide the correct
                    password. This is not a password cracking tool.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              Unlock settings
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              Enter the current PDF password to create an unlocked copy.
            </p>

            <div className="mt-5">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Current PDF password
              </label>

              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#080B10]">
                <KeyRound size={18} className="text-[#F97316]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-black text-[#111827] outline-none dark:text-white"
                  placeholder="Enter PDF password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="text-[#78716C] transition hover:text-[#F97316] dark:text-white/55"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/70 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              <input
                type="checkbox"
                checked={confirmOwnership}
                disabled={isProcessing || Boolean(job)}
                onChange={(event) => setConfirmOwnership(event.target.checked)}
                className="mt-0.5 h-5 w-5 accent-[#F97316]"
              />
              <span>
                <span className="block text-sm font-black text-[#111827] dark:text-white">
                  I have permission to unlock this PDF
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-[#78716C] dark:text-white/55">
                  Use this only for PDFs you own or are authorized to access.
                </span>
              </span>
            </label>

            {isProcessing && (
              <ToolProcessingPanel
                title="Unlocking PDF"
                subtitle="FileGrip is verifying the password and preparing an unlocked copy."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Unlocked PDF"
                  resetLabel="Unlock another PDF"
                  onReset={clearFile}
                />
              </div>
            )}

            {!job && (
              <button
                type="button"
                onClick={unlockPdf}
                disabled={isProcessing}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Unlock size={18} />
                    Unlock PDF
                  </>
                )}
              </button>
            )}
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