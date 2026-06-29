/** @format */

"use client";

/** @format */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Droplets,
  FileText,
  Loader2,
  Move,
  RotateCw,
  Stamp,
  Type,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";
import useFileDropzone from "../../hooks/useFileDropzone";

type AddWatermarkUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
};

const positions: { key: Position; label: string }[] = [
  { key: "top-left", label: "TL" },
  { key: "top-center", label: "TC" },
  { key: "top-right", label: "TR" },
  { key: "middle-left", label: "ML" },
  { key: "center", label: "C" },
  { key: "middle-right", label: "MR" },
  { key: "bottom-left", label: "BL" },
  { key: "bottom-center", label: "BC" },
  { key: "bottom-right", label: "BR" },
];

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function watermarkBasePosition(position: Position) {
  const map: Record<
    Position,
    {
      left?: string;
      right?: string;
      top?: string;
      bottom?: string;
      translateX: string;
      translateY: string;
    }
  > = {
    "top-left": {
      left: "15%",
      top: "15%",
      translateX: "0",
      translateY: "0",
    },
    "top-center": {
      left: "50%",
      top: "15%",
      translateX: "-50%",
      translateY: "0",
    },
    "top-right": {
      right: "15%",
      top: "15%",
      translateX: "0",
      translateY: "0",
    },
    "middle-left": {
      left: "15%",
      top: "50%",
      translateX: "0",
      translateY: "-50%",
    },
    center: {
      left: "50%",
      top: "50%",
      translateX: "-50%",
      translateY: "-50%",
    },
    "middle-right": {
      right: "15%",
      top: "50%",
      translateX: "0",
      translateY: "-50%",
    },
    "bottom-left": {
      left: "15%",
      bottom: "15%",
      translateX: "0",
      translateY: "0",
    },
    "bottom-center": {
      left: "50%",
      bottom: "15%",
      translateX: "-50%",
      translateY: "0",
    },
    "bottom-right": {
      right: "15%",
      bottom: "15%",
      translateX: "0",
      translateY: "0",
    },
  };

  return map[position];
}

export default function AddWatermarkUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: AddWatermarkUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(42);
  const [opacity, setOpacity] = useState(28);
  const [rotation, setRotation] = useState(-35);
  const [position, setPosition] = useState<Position>("center");
  const [repeatWatermark, setRepeatWatermark] = useState(false);
  const [pageRange, setPageRange] = useState("all");
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

  const { isDragging, dropzoneHandlers } = useFileDropzone({
    disabled: isProcessing || Boolean(job),
    multiple: false,
    onFilesDrop: (droppedFiles) => {
      handleFile(droppedFiles[0] ?? null);
    },
  });

  const previewWatermarks = useMemo(() => {
    if (!repeatWatermark) return [0];

    return Array.from({ length: 15 }).map((_, index) => index);
  }, [repeatWatermark]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

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
        message: `"${file.name}" is bigger than our current upload limit. Compress it first, then return to watermark it.`,
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!isPdf(file)) {
      setError("Add Watermark only accepts PDF files.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setPdfPreviewUrl(previewUrl);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }

    setSelectedFile(null);
    setPdfPreviewUrl("");
    setWatermarkText("CONFIDENTIAL");
    setFontSize(42);
    setOpacity(28);
    setRotation(-35);
    setPosition("center");
    setRepeatWatermark(false);
    setPageRange("all");
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  function validate() {
    if (!selectedFile) return "Please choose a PDF first.";
    if (watermarkText.trim().length < 1) return "Please enter watermark text.";

    return "";
  }

  async function addWatermark() {
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
            watermark_text: watermarkText.trim(),
            font_size: fontSize,
            opacity,
            rotation,
            position,
            repeat_watermark: repeatWatermark,
            page_range: pageRange,
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

  function renderSingleWatermark() {
    const base = watermarkBasePosition(position);

    return (
      <div
        className="absolute whitespace-nowrap font-black uppercase text-[#F97316]"
        style={{
          left: base.left,
          right: base.right,
          top: base.top,
          bottom: base.bottom,
          fontSize: `clamp(1.2rem, ${fontSize * 0.035}rem, 4.2rem)`,
          opacity: opacity / 100,
          transform: `translate(${base.translateX}, ${base.translateY}) rotate(${rotation}deg)`,
          textShadow: "0 8px 22px rgba(17,24,39,0.18)",
        }}>
        {watermarkText || "WATERMARK"}
      </div>
    );
  }

  function renderRepeatedWatermarks() {
    return (
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-5">
        {previewWatermarks.map((item) => (
          <div
            key={item}
            className="flex items-center justify-center overflow-hidden">
            <span
              className="whitespace-nowrap font-black uppercase text-[#F97316]"
              style={{
                fontSize: `clamp(1rem, ${fontSize * 0.026}rem, 2.6rem)`,
                opacity: opacity / 100,
                transform: `rotate(${rotation}deg)`,
                textShadow: "0 8px 22px rgba(17,24,39,0.18)",
              }}>
              {watermarkText || "WATERMARK"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
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
              Drop PDF to upload
            </div>
          </div>
        )}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Stamp size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Add Watermark
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Upload a PDF and see your watermark live on the actual document
          preview before processing.
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
          {selectedFile ? "Choose another PDF" : "Select PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          PDF supported · Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.98fr)_minmax(340px,0.78fr)]">
          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:text-white/60">
                  <X size={15} />
                  Remove
                </button>
              )}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-[#111827] p-3 dark:border-white/10 sm:p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                  <Move size={14} />
                  Live document preview
                </div>

                <div className="rounded-full bg-[#F97316] px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                  {repeatWatermark ? "Repeated" : position.replace("-", " ")}
                </div>
              </div>

              <div className="mx-auto max-h-[72vh] max-w-[760px] overflow-hidden rounded-2xl bg-[#0B1220] p-2 sm:max-h-[620px]">
                <div className="relative mx-auto aspect-[1/1.35] max-h-[68vh] max-w-[460px] overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[580px]">
                  {pdfPreviewUrl ? (
                    <iframe
                      title="PDF watermark live preview"
                      src={`${pdfPreviewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white text-sm font-black text-[#F97316]">
                      PDF preview loading...
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-white/0">
                    {repeatWatermark
                      ? renderRepeatedWatermarks()
                      : renderSingleWatermark()}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-[11px] font-bold leading-5 text-white/55">
                Preview shows page 1 with the watermark overlay. Backend will
                apply it to your selected page range.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              Watermark settings
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              Changes update instantly on the document preview.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  <Type size={15} />
                  Watermark text
                </label>

                <input
                  value={watermarkText}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setWatermarkText(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                  placeholder="CONFIDENTIAL"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                    Size · {fontSize}px
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={90}
                    value={fontSize}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) =>
                      setFontSize(Number(event.target.value))
                    }
                    className="mt-4 w-full accent-[#F97316]"
                  />
                </div>

                <div className="rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                    <Droplets size={15} />
                    Opacity · {opacity}%
                  </label>
                  <input
                    type="range"
                    min={8}
                    max={80}
                    value={opacity}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) => setOpacity(Number(event.target.value))}
                    className="mt-4 w-full accent-[#F97316]"
                  />
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  <RotateCw size={15} />
                  Rotation · {rotation}°
                </label>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  value={rotation}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setRotation(Number(event.target.value))}
                  className="mt-4 w-full accent-[#F97316]"
                />
              </div>

              <div className="rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Position
                </label>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {positions.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      disabled={repeatWatermark || isProcessing || Boolean(job)}
                      onClick={() => setPosition(item.key)}
                      className={`rounded-2xl border px-3 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        position === item.key && !repeatWatermark
                          ? "border-[#F97316] bg-[#F97316] text-white"
                          : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#F97316] hover:text-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                      }`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/70 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
                <input
                  type="checkbox"
                  checked={repeatWatermark}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setRepeatWatermark(event.target.checked)}
                  className="mt-0.5 h-5 w-5 accent-[#F97316]"
                />
                <span>
                  <span className="block text-sm font-black text-[#111827] dark:text-white">
                    Repeat watermark across page
                  </span>
                  <span className="mt-1 block text-xs font-bold text-[#78716C] dark:text-white/55">
                    Best for confidential or draft documents.
                  </span>
                </span>
              </label>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Page range
                </label>
                <input
                  value={pageRange}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setPageRange(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                  placeholder="all or 1-3,5"
                />
              </div>
            </div>

            {isProcessing && (
              <ToolProcessingPanel
                title="Adding watermark"
                subtitle="FileGrip is applying your watermark settings to the PDF."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Watermarked PDF"
                  resetLabel="Watermark another PDF"
                  onReset={clearFile}
                />
              </div>
            )}

            {!job && (
              <button
                type="button"
                onClick={addWatermark}
                disabled={isProcessing}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60">
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Adding watermark...
                  </>
                ) : (
                  <>
                    <Stamp size={18} />
                    Add Watermark
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
