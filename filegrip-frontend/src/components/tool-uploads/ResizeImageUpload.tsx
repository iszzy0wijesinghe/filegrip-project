"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  FileImage,
  ImageIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type ResizeImageUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type OutputFormat = "jpg" | "png" | "webp";

type ImageMeta = {
  width: number;
  height: number;
};

type Preset = {
  label: string;
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

const presets: Preset[] = [
  { label: "Instagram square", width: 1080, height: 1080 },
  { label: "HD 16:9", width: 1280, height: 720 },
  { label: "Full HD", width: 1920, height: 1080 },
  { label: "Profile photo", width: 512, height: 512 },
];

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

function getFileExtension(file: File): OutputFormat {
  const name = file.name.toLowerCase();

  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";

  return "jpg";
}

export default function ResizeImageUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: ResizeImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [resizeWidth, setResizeWidth] = useState("");
  const [resizeHeight, setResizeHeight] = useState("");
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
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
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      setImageMeta({ width, height });
      setResizeWidth(String(width));
      setResizeHeight(String(height));
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
        message: `"${file.name}" is bigger than the current upload limit. Compress it first, then resize it.`,
        actionLabel: "Compress Image",
        actionHref: "/tools/compress-image",
        variant: "compress",
      });
      return;
    }

    if (!isSupportedImage(file)) {
      setError("Resize Image only accepts JPG, PNG, and WEBP files.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const url = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(url);
    setImageMeta(null);
    setOutputFormat(getFileExtension(file));
    loadImageMeta(url);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(null);
    setPreviewUrl("");
    setImageMeta(null);
    setResizeWidth("");
    setResizeHeight("");
    setKeepAspectRatio(true);
    setOutputFormat("webp");
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  function handleWidthChange(value: string) {
    setResizeWidth(value);

    if (!keepAspectRatio || !imageMeta) return;

    const width = Number(value);

    if (!Number.isFinite(width) || width <= 0) return;

    const ratio = imageMeta.height / imageMeta.width;
    setResizeHeight(String(Math.round(width * ratio)));
  }

  function handleHeightChange(value: string) {
    setResizeHeight(value);

    if (!keepAspectRatio || !imageMeta) return;

    const height = Number(value);

    if (!Number.isFinite(height) || height <= 0) return;

    const ratio = imageMeta.width / imageMeta.height;
    setResizeWidth(String(Math.round(height * ratio)));
  }

  function applyPreset(preset: Preset) {
    setResizeWidth(String(preset.width));
    setResizeHeight(String(preset.height));
  }

  function applyHalfSize() {
    if (!imageMeta) return;

    setResizeWidth(String(Math.round(imageMeta.width / 2)));
    setResizeHeight(String(Math.round(imageMeta.height / 2)));
  }

  function validateSettings() {
    if (!selectedFile) return "Please choose an image first.";

    const width = Number(resizeWidth);
    const height = Number(resizeHeight);

    if (!Number.isFinite(width) || width < 1) {
      return "Please enter a valid resize width.";
    }

    if (!Number.isFinite(height) || height < 1) {
      return "Please enter a valid resize height.";
    }

    if (width > 12000 || height > 12000) {
      return "Resize dimensions are too large. Use 12000px or smaller.";
    }

    return "";
  }

  async function processFile() {
    const validationError = validateSettings();

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
            width: Number(resizeWidth),
            height: Number(resizeHeight),
            keep_aspect_ratio: keepAspectRatio,
            output_format: outputFormat,
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
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-6 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Maximize2 size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Resize image
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Change image width and height with smart aspect-ratio protection,
          clean presets, and format control.
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
                    <span>{formatFileSize(selectedFile.size)}</span>
                    {imageMeta && (
                      <>
                        <span>•</span>
                        <span>
                          Original: {imageMeta.width} × {imageMeta.height}px
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
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/60"
                >
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
              Resize settings
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              Enter exact pixel dimensions or use one of the quick presets.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Width
                </label>
                <input
                  type="number"
                  min={1}
                  value={resizeWidth}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => handleWidthChange(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                  placeholder="Width px"
                />
              </div>

              <div className="rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Height
                </label>
                <input
                  type="number"
                  min={1}
                  value={resizeHeight}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => handleHeightChange(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                  placeholder="Height px"
                />
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/70 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              <input
                type="checkbox"
                checked={keepAspectRatio}
                disabled={isProcessing || Boolean(job)}
                onChange={(event) => setKeepAspectRatio(event.target.checked)}
                className="h-5 w-5 accent-[#F97316]"
              />
              <span className="text-sm font-black text-[#111827] dark:text-white">
                Keep aspect ratio
              </span>
            </label>

            <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Quick presets
              </label>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={applyHalfSize}
                  disabled={!imageMeta || isProcessing || Boolean(job)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                >
                  <RefreshCw size={15} />
                  50% smaller
                </button>

                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    disabled={isProcessing || Boolean(job)}
                    className="rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Output format
              </label>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["jpg", "png", "webp"] as OutputFormat[]).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => setOutputFormat(format)}
                    disabled={isProcessing || Boolean(job)}
                    className={`inline-flex items-center justify-center gap-1 rounded-full border px-4 py-2 text-xs font-black uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      outputFormat === format
                        ? "border-[#F97316] bg-[#F97316] text-white"
                        : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#F97316] hover:text-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                    }`}
                  >
                    {outputFormat === format && <Check size={13} />}
                    {format}
                  </button>
                ))}
              </div>
            </div>

            {isProcessing && (
              <ToolProcessingPanel
                title="Resizing image"
                subtitle="FileGrip is resizing your image to the selected dimensions."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Image"
                  resetLabel="Resize another image"
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
                    Resizing...
                  </>
                ) : (
                  <>
                    <Maximize2 size={18} />
                    Resize Image
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