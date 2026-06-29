/** @format */

"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  FileImage,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";
import useFileDropzone from "../../hooks/useFileDropzone";

type ConvertImageUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type OutputFormat = "jpg" | "png" | "webp";

type ImageMeta = {
  width: number;
  height: number;
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

function isSupportedImage(file: File) {
  const name = file.name.toLowerCase();

  return (
    file.type.startsWith("image/") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function getDetectedFormat(file: File) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".png")) return "PNG";
  if (name.endsWith(".webp")) return "WEBP";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPG";

  return "IMAGE";
}

function getFileExtension(file: File): OutputFormat {
  const name = file.name.toLowerCase();

  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";

  return "jpg";
}

function formatDescription(format: OutputFormat) {
  if (format === "jpg") return "Best for photos and smaller standard images.";
  if (format === "png") return "Best for transparency and crisp graphics.";
  return "Best for modern websites and smaller high-quality files.";
}

export default function ConvertImageUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: ConvertImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [quality, setQuality] = useState(88);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webp");
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
      : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

  const { isDragging, dropzoneHandlers } = useFileDropzone({
    disabled: isProcessing || Boolean(job),
    multiple: false,
    onFilesDrop: (droppedFiles) => {
      handleFile(droppedFiles[0] ?? null);
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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

  function loadImageMeta(url: string) {
    const image = new Image();

    image.onload = () => {
      setImageMeta({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.src = url;
  }

  function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, this image is too large.",
        message: `"${file.name}" is bigger than the current upload limit. Compress it first, then convert it.`,
        actionLabel: "Compress Image",
        actionHref: "/tools/compress-image",
        variant: "compress",
      });

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!isSupportedImage(file)) {
      setError("Convert Image only accepts JPG, PNG, and WEBP files.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const url = URL.createObjectURL(file);
    const currentFormat = getFileExtension(file);

    setSelectedFile(file);
    setPreviewUrl(url);
    setImageMeta(null);
    setOutputFormat(currentFormat === "webp" ? "jpg" : "webp");
    loadImageMeta(url);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(null);
    setPreviewUrl("");
    setImageMeta(null);
    setQuality(88);
    setOutputFormat("webp");
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  async function processFile() {
    if (!selectedFile) {
      setError("Please choose an image first.");
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
            output_format: outputFormat,
            quality,
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
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div
        {...dropzoneHandlers}
        className={`relative overflow-hidden rounded-[1.5rem] border-2 border-dashed p-5 text-center transition duration-200 sm:p-6 ${
          isDragging
            ? "scale-[1.01] border-[#F97316] bg-[#FFF7ED] shadow-[0_24px_60px_rgba(249,115,22,0.18)] dark:border-[#F97316] dark:bg-[#F97316]/15"
            : "border-[#FDBA74] bg-[#FFF7ED] hover:border-[#F97316] hover:bg-[#FFF7ED]/90 dark:border-[#F97316]/50 dark:bg-[#F97316]/10 dark:hover:border-[#F97316]"
        }`}>
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[1.5rem] bg-[#F97316]/12 backdrop-blur-[2px]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F97316] px-5 py-2.5 text-sm font-black text-white shadow-[0_18px_42px_rgba(249,115,22,0.32)]">
              <Upload size={17} />
              Drop image to upload
            </div>
          </div>
        )}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <RefreshCw size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Convert image format
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Convert JPG, PNG, and WEBP images into the format you need with clean
          quality control.
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
          disabled={isProcessing || Boolean(job)}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#F97316] dark:hover:bg-[#FB923C]">
          <Upload size={18} />
          {selectedFile ? "Choose another image" : "Select image"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          JPG, PNG, WEBP supported · Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] dark:bg-[#F97316]/10">
                  <ImageIcon size={28} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#111827] dark:text-white">
                    {selectedFile.name}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-[#78716C] dark:text-white/45">
                    <span>Input: {getDetectedFormat(selectedFile)}</span>
                    <span>•</span>
                    <span>{formatFileSize(selectedFile.size)}</span>
                    {imageMeta && (
                      <>
                        <span>•</span>
                        <span>
                          {imageMeta.width} × {imageMeta.height}px
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!isProcessing && !job && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/60">
                  <X size={15} />
                  Remove
                </button>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.25rem] border border-[#E7E5E4] bg-[#FFF7ED]/70 p-4 dark:border-white/10 dark:bg-[#F97316]/10">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="mx-auto max-h-[430px] max-w-full rounded-xl object-contain shadow-[0_18px_45px_rgba(17,24,39,0.12)]"
                />
              ) : (
                <div className="flex min-h-[260px] items-center justify-center">
                  <FileImage className="text-[#F97316]" size={44} />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              Choose output format
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              Pick the best format for your use case.
            </p>

            <div className="mt-5 grid gap-3">
              {(["jpg", "png", "webp"] as OutputFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setOutputFormat(format)}
                  disabled={isProcessing || Boolean(job)}
                  className={`group rounded-[1.25rem] border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    outputFormat === format
                      ? "border-[#F97316] bg-[#FFF7ED] shadow-[0_18px_35px_rgba(249,115,22,0.12)] dark:bg-[#F97316]/10"
                      : "border-[#E7E5E4] bg-[#FAFAF9] hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.04]"
                  }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-black uppercase text-[#111827] dark:text-white">
                        {format}
                      </p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                        {formatDescription(format)}
                      </p>
                    </div>

                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        outputFormat === format
                          ? "border-[#F97316] bg-[#F97316] text-white"
                          : "border-[#E7E5E4] text-[#A8A29E] dark:border-white/10"
                      }`}>
                      {outputFormat === format ? (
                        <Check size={18} />
                      ) : (
                        <Sparkles size={18} />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {(outputFormat === "jpg" || outputFormat === "webp") && (
              <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                    Quality
                  </label>
                  <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-black text-[#F97316] dark:bg-[#F97316]/10">
                    {quality}%
                  </span>
                </div>

                <input
                  type="range"
                  min={40}
                  max={100}
                  value={quality}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="mt-4 w-full accent-[#F97316]"
                />
              </div>
            )}

            {isProcessing && (
              <ToolProcessingPanel
                title="Converting image"
                subtitle="FileGrip is converting your image into the selected format."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Image"
                  resetLabel="Convert another image"
                  onReset={clearFile}
                />
              </div>
            )}

            {!job && (
              <button
                type="button"
                onClick={processFile}
                disabled={isProcessing}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60">
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Convert to {outputFormat.toUpperCase()}
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
