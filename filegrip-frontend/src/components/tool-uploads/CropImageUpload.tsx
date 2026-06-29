/** @format */

"use client";

/** @format */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Crop,
  FileImage,
  ImageIcon,
  Loader2,
  Maximize2,
  Move,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type CropImageUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type OutputFormat = "jpg" | "png" | "webp";

type ImageMeta = {
  width: number;
  height: number;
};

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode =
  | "new"
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "e"
  | "w";

type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  startCrop: CropPixels;
};

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
};

const minCropSize = 20;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function normalizeCrop(crop: CropPixels, meta: ImageMeta): CropPixels {
  const width = clamp(Math.round(crop.width), minCropSize, meta.width);
  const height = clamp(Math.round(crop.height), minCropSize, meta.height);
  const x = clamp(Math.round(crop.x), 0, meta.width - width);
  const y = clamp(Math.round(crop.y), 0, meta.height - height);

  return { x, y, width, height };
}

function cropToStyle(crop: CropPixels, meta: ImageMeta) {
  return {
    left: `${(crop.x / meta.width) * 100}%`,
    top: `${(crop.y / meta.height) * 100}%`,
    width: `${(crop.width / meta.width) * 100}%`,
    height: `${(crop.height / meta.height) * 100}%`,
  };
}

export default function CropImageUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: CropImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [cropPixels, setCropPixels] = useState<CropPixels>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(90);
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
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [previewUrl, croppedPreviewUrl]);

  useEffect(() => {
    if (!job || isProcessing) return;

    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [job, isProcessing]);

  const updateCroppedPreview = useCallback(async () => {
    if (!selectedFile || !imageMeta) return;

    const crop = normalizeCrop(cropPixels, imageMeta);

    if (crop.width < 1 || crop.height < 1) return;

    try {
      const bitmap = await createImageBitmap(selectedFile);

      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;

      const context = canvas.getContext("2d");

      if (!context) {
        bitmap.close();
        return;
      }

      if (outputFormat === "jpg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, crop.width, crop.height);
      }

      context.drawImage(
        bitmap,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );

      bitmap.close();

      const mimeType =
        outputFormat === "png"
          ? "image/png"
          : outputFormat === "webp"
            ? "image/webp"
            : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob) return;

          const nextUrl = URL.createObjectURL(blob);

          setCroppedPreviewUrl((oldUrl) => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return nextUrl;
          });
        },
        mimeType,
        quality / 100,
      );
    } catch {
      setError("Live crop preview could not be generated for this image.");
    }
  }, [cropPixels, imageMeta, outputFormat, quality, selectedFile]);

  useEffect(() => {
    if (!selectedFile || !imageMeta) return;

    const timer = window.setTimeout(() => {
      void updateCroppedPreview();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    selectedFile,
    imageMeta,
    cropPixels,
    outputFormat,
    quality,
    updateCroppedPreview,
  ]);

  function closeLimitModal() {
    setLimitModal((current) => ({ ...current, isOpen: false }));
  }

  function clientPointToImagePoint(clientX: number, clientY: number) {
    const image = imageRef.current;

    if (!image || !imageMeta) {
      return { x: 0, y: 0 };
    }

    const rect = image.getBoundingClientRect();

    const x = clamp(
      ((clientX - rect.left) / rect.width) * imageMeta.width,
      0,
      imageMeta.width,
    );

    const y = clamp(
      ((clientY - rect.top) / rect.height) * imageMeta.height,
      0,
      imageMeta.height,
    );

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function loadImageMeta(url: string) {
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;

      const initialCrop = {
        x: Math.round(width * 0.1),
        y: Math.round(height * 0.1),
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.8),
      };

      setImageMeta({ width, height });
      setCropPixels(initialCrop);
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
        message: `"${file.name}" is bigger than the current upload limit. Compress it first, then crop it.`,
        actionLabel: "Compress Image",
        actionHref: "/tools/compress-image",
        variant: "compress",
      });
      return;
    }

    if (!isSupportedImage(file)) {
      setError("Crop Image only accepts JPG, PNG, and WEBP files.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);

    const url = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(url);
    setCroppedPreviewUrl("");
    setImageMeta(null);
    setOutputFormat(getFileExtension(file));
    setQuality(90);
    loadImageMeta(url);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);

    setSelectedFile(null);
    setPreviewUrl("");
    setCroppedPreviewUrl("");
    setImageMeta(null);
    setCropPixels({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    setOutputFormat("webp");
    setQuality(90);
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  function beginNewCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageMeta || isProcessing || job) return;

    const point = clientPointToImagePoint(event.clientX, event.clientY);

    const startCrop = {
      x: point.x,
      y: point.y,
      width: minCropSize,
      height: minCropSize,
    };

    setCropPixels(normalizeCrop(startCrop, imageMeta));

    dragStateRef.current = {
      mode: "new",
      startX: point.x,
      startY: point.y,
      startCrop,
    };

    editorRef.current?.setPointerCapture(event.pointerId);
  }

  function beginDrag(
    event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>,
    mode: DragMode,
  ) {
    if (!imageMeta || isProcessing || job) return;

    event.preventDefault();
    event.stopPropagation();

    const point = clientPointToImagePoint(event.clientX, event.clientY);

    dragStateRef.current = {
      mode,
      startX: point.x,
      startY: point.y,
      startCrop: cropPixels,
    };

    editorRef.current?.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageMeta || !dragStateRef.current) return;

    const dragState = dragStateRef.current;
    const point = clientPointToImagePoint(event.clientX, event.clientY);
    const start = dragState.startCrop;

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (dragState.mode === "new") {
      const x = Math.min(dragState.startX, point.x);
      const y = Math.min(dragState.startY, point.y);
      const width = Math.abs(point.x - dragState.startX);
      const height = Math.abs(point.y - dragState.startY);

      setCropPixels(
        normalizeCrop(
          {
            x,
            y,
            width: Math.max(width, minCropSize),
            height: Math.max(height, minCropSize),
          },
          imageMeta,
        ),
      );

      return;
    }

    if (dragState.mode === "move") {
      setCropPixels(
        normalizeCrop(
          {
            ...start,
            x: start.x + deltaX,
            y: start.y + deltaY,
          },
          imageMeta,
        ),
      );

      return;
    }

    let nextCrop = { ...start };

    if (dragState.mode.includes("w")) {
      nextCrop.x = start.x + deltaX;
      nextCrop.width = start.width - deltaX;
    }

    if (dragState.mode.includes("e")) {
      nextCrop.width = start.width + deltaX;
    }

    if (dragState.mode.includes("n")) {
      nextCrop.y = start.y + deltaY;
      nextCrop.height = start.height - deltaY;
    }

    if (dragState.mode.includes("s")) {
      nextCrop.height = start.height + deltaY;
    }

    setCropPixels(normalizeCrop(nextCrop, imageMeta));
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStateRef.current) return;

    dragStateRef.current = null;

    try {
      editorRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }
  }

  function applyPreset(
    type: "original" | "square" | "16:9" | "4:3" | "portrait",
  ) {
    if (!imageMeta) return;

    if (type === "original") {
      setCropPixels({
        x: 0,
        y: 0,
        width: imageMeta.width,
        height: imageMeta.height,
      });
      return;
    }

    const targetRatio =
      type === "square"
        ? 1
        : type === "16:9"
          ? 16 / 9
          : type === "4:3"
            ? 4 / 3
            : 4 / 5;

    let width = Math.round(imageMeta.width * 0.82);
    let height = Math.round(width / targetRatio);

    if (height > imageMeta.height * 0.82) {
      height = Math.round(imageMeta.height * 0.82);
      width = Math.round(height * targetRatio);
    }

    setCropPixels(
      normalizeCrop(
        {
          x: Math.round((imageMeta.width - width) / 2),
          y: Math.round((imageMeta.height - height) / 2),
          width,
          height,
        },
        imageMeta,
      ),
    );
  }

  function updatePixelValue(key: keyof CropPixels, value: string) {
    if (!imageMeta) return;

    const numberValue = Math.max(0, Math.round(Number(value) || 0));

    const nextCrop = {
      ...cropPixels,
      [key]: numberValue,
    };

    setCropPixels(normalizeCrop(nextCrop, imageMeta));
  }

  function validateSettings() {
    if (!selectedFile) return "Please choose an image first.";
    if (!imageMeta) return "Please wait for the image preview to load.";

    const crop = normalizeCrop(cropPixels, imageMeta);

    if (crop.width < 1 || crop.height < 1) {
      return "Crop width and height must be at least 1px.";
    }

    if (crop.x + crop.width > imageMeta.width) {
      return "Crop area goes outside the image width.";
    }

    if (crop.y + crop.height > imageMeta.height) {
      return "Crop area goes outside the image height.";
    }

    return "";
  }

  async function processFile() {
    const validationError = validateSettings();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!selectedFile || !imageMeta) return;

    const crop = normalizeCrop(cropPixels, imageMeta);

    setIsProcessing(true);
    setError("");
    setJob(null);

    try {
      const [result] = await Promise.all([
        createFileJob({
          toolSlug,
          files: [selectedFile],
          settings: {
            crop_x: crop.x,
            crop_y: crop.y,
            crop_width: crop.width,
            crop_height: crop.height,
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

  const cropStyle = imageMeta ? cropToStyle(cropPixels, imageMeta) : {};

  return (
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-6 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Crop size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Crop image
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Drag anywhere to create a crop area, resize from edges, move it
          freely, and preview the final crop before downloading.
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
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#F97316] dark:hover:bg-[#FB923C]">
          <Upload size={18} />
          {selectedFile ? "Choose another image" : "Select image"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          JPG, PNG, WEBP supported · Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(330px,0.75fr)]">
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

            <div className="mt-5 rounded-[1.25rem] border border-[#E7E5E4] bg-[#111827] p-3 dark:border-white/10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                  <Move size={14} />
                  Drag anywhere to crop
                </div>

                <div className="rounded-full bg-[#F97316] px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                  {cropPixels.width} × {cropPixels.height}px
                </div>
              </div>

              {previewUrl ? (
                <div className="mx-auto flex max-h-[68vh] max-w-[720px] items-center justify-center overflow-hidden rounded-2xl bg-black p-2 sm:max-h-[560px]">
                  <div
                    ref={editorRef}
                    className="relative mx-auto touch-none select-none"
                    onPointerDown={beginNewCrop}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrag}
                    onPointerCancel={stopDrag}>
                    <img
                      ref={imageRef}
                      src={previewUrl}
                      alt={selectedFile.name}
                      className="block h-auto max-h-[58vh] w-auto max-w-full rounded-xl object-contain sm:max-h-[500px]"
                      draggable={false}
                    />

                    <div className="absolute inset-0 rounded-xl bg-black/45" />

                    {imageMeta && (
                      <div
                        className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]"
                        style={cropStyle}
                        onPointerDown={(event) => beginDrag(event, "move")}>
                        <div className="absolute inset-0 bg-white/5" />

                        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {Array.from({ length: 9 }).map((_, index) => (
                            <div
                              key={index}
                              className="border border-white/35"
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          aria-label="Resize top left"
                          onPointerDown={(event) => beginDrag(event, "nw")}
                          className="absolute -left-2.5 -top-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-left-3 sm:-top-3 sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize top"
                          onPointerDown={(event) => beginDrag(event, "n")}
                          className="absolute left-1/2 -top-2.5 h-5 w-5 -translate-x-1/2 cursor-ns-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-top-3 sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize top right"
                          onPointerDown={(event) => beginDrag(event, "ne")}
                          className="absolute -right-2.5 -top-2.5 h-5 w-5 cursor-nesw-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-right-3 sm:-top-3 sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize right"
                          onPointerDown={(event) => beginDrag(event, "e")}
                          className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-right-3 sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize bottom right"
                          onPointerDown={(event) => beginDrag(event, "se")}
                          className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-bottom-3 sm:-right-3 sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize bottom"
                          onPointerDown={(event) => beginDrag(event, "s")}
                          className="absolute bottom-[-10px] left-1/2 h-5 w-5 -translate-x-1/2 cursor-ns-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:bottom-[-12px] sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize bottom left"
                          onPointerDown={(event) => beginDrag(event, "sw")}
                          className="absolute -bottom-2.5 -left-2.5 h-5 w-5 cursor-nesw-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-bottom-3 sm:-left-3 sm:h-6 sm:w-6"
                        />
                        <button
                          type="button"
                          aria-label="Resize left"
                          onPointerDown={(event) => beginDrag(event, "w")}
                          className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg sm:-left-3 sm:h-6 sm:w-6"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center sm:min-h-[280px]">
                  <FileImage className="text-[#F97316]" size={44} />
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {[
                ["original", "Original"],
                ["square", "Square"],
                ["16:9", "16:9"],
                ["4:3", "4:3"],
                ["portrait", "4:5"],
              ].map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    applyPreset(
                      preset as
                        | "original"
                        | "square"
                        | "16:9"
                        | "4:3"
                        | "portrait",
                    )
                  }
                  disabled={isProcessing || Boolean(job)}
                  className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] px-3 py-2.5 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              Live crop preview
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              This preview updates from your crop frame.
            </p>

            <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/80 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              {croppedPreviewUrl ? (
                <img
                  src={croppedPreviewUrl}
                  alt="Cropped preview"
                  className="mx-auto max-h-[220px] max-w-full rounded-xl object-contain shadow-[0_18px_45px_rgba(17,24,39,0.12)] sm:max-h-[260px]"
                />
              ) : (
                <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[#FDBA74] text-sm font-black text-[#F97316]">
                  Preview loading...
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  X
                </label>
                <input
                  type="number"
                  min={0}
                  value={cropPixels.x}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) =>
                    updatePixelValue("x", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Y
                </label>
                <input
                  type="number"
                  min={0}
                  value={cropPixels.y}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) =>
                    updatePixelValue("y", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Width
                </label>
                <input
                  type="number"
                  min={1}
                  value={cropPixels.width}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) =>
                    updatePixelValue("width", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Height
                </label>
                <input
                  type="number"
                  min={1}
                  value={cropPixels.height}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) =>
                    updatePixelValue("height", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                />
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
                    }`}>
                    {outputFormat === format && <Check size={13} />}
                    {format}
                  </button>
                ))}
              </div>
            </div>

            {(outputFormat === "jpg" || outputFormat === "webp") && (
              <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between">
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

            <div className="mt-4 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/75 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                <Maximize2 size={15} />
                Free-form crop
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-[#78716C] dark:text-white/55">
                Drag anywhere on the image to create a custom crop area. Move or
                resize the box before processing.
              </p>
            </div>

            {isProcessing && (
              <ToolProcessingPanel
                title="Cropping image"
                subtitle="FileGrip is cropping your image using the selected preview area."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Image"
                  resetLabel="Crop another image"
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
                    Cropping...
                  </>
                ) : (
                  <>
                    <Crop size={18} />
                    Crop Image
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
