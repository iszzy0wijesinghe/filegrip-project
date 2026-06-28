"use client";

/** @format */

import { useRef, useState } from "react";
import {
  AlertCircle,
  FileImage,
  GripVertical,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";

type ImageToPdfUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type SelectedImageFile = {
  id: string;
  file: File;
  previewUrl: string;
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

function createFileId(file: File) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
  }

  return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random()}`;
}

export default function ImageToPdfUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: ImageToPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedImageFile[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<FileJobResponse | null>(null);
  const [error, setError] = useState("");

  const acceptedTypes = inputTypes
    ?.map((type) => `.${type.toLowerCase()}`)
    .join(",");

  function handleFiles(files: FileList | null) {
    setError("");
    setJob(null);

    if (!files || files.length === 0) return;

    const incomingFiles = Array.from(files);
    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    const tooLarge = incomingFiles.find((file) => file.size > maxBytes);

    if (tooLarge) {
      setError(`"${tooLarge.name}" is larger than ${maxFileSizeMb} MB.`);
      return;
    }

    const imageError = incomingFiles.find(
      (file) => !file.type.startsWith("image/"),
    );

    if (imageError) {
      setError("This tool only accepts image files.");
      return;
    }

    const preparedFiles: SelectedImageFile[] = incomingFiles.map((file) => ({
      id: createFileId(file),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedFiles((current) => [...current, ...preparedFiles]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function removeFile(id: string) {
    setSelectedFiles((files) => {
      const target = files.find((item) => item.id === id);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return files.filter((item) => item.id !== id);
    });

    setJob(null);
    setError("");
  }

  function clearFiles() {
    selectedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setSelectedFiles([]);
    setJob(null);
    setError("");
    setIsProcessing(false);
  }

  function moveFile(fromIndex: number, toIndex: number) {
    setSelectedFiles((files) => {
      if (toIndex < 0 || toIndex >= files.length) return files;

      const nextFiles = [...files];
      const [movedFile] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, movedFile);

      return nextFiles;
    });
  }

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }

    setSelectedFiles((files) => {
      const fromIndex = files.findIndex((item) => item.id === draggingId);
      const toIndex = files.findIndex((item) => item.id === targetId);

      if (fromIndex === -1 || toIndex === -1) return files;

      const nextFiles = [...files];
      const [movedFile] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, movedFile);

      return nextFiles;
    });

    setDraggingId(null);
  }

  async function processFiles() {
    if (selectedFiles.length === 0) {
      setError("Please choose at least one image.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setJob(null);

    try {
      const [result] = await Promise.all([
        createFileJob({
          toolSlug,
          files: selectedFiles.map((item) => item.file),
          settings: {
            order: selectedFiles.map((item, index) => ({
              index,
              name: item.file.name,
            })),
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
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-6 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Upload size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Add images to convert
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#78716C] dark:text-white/60">
          Add JPG or PNG files. Drag to reorder before creating the PDF.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes || "image/*"}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
        >
          <Plus size={18} />
          {selectedFiles.length > 0 ? "Add more images" : "Select images"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          Max file size: {maxFileSizeMb ?? 25} MB each
        </p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-black text-[#111827] dark:text-white">
                Image order
              </p>
              <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
                {selectedFiles.length} images selected. Drag cards to change
                order.
              </p>
            </div>

            <div className="flex gap-2">
              {!job && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={isProcessing}
                  className="rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white/60"
                >
                  Add more
                </button>
              )}

              <button
                type="button"
                onClick={clearFiles}
                disabled={isProcessing}
                className="rounded-full border border-[#E7E5E4] px-4 py-2 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:border-red-500/40 dark:hover:text-red-300"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
            {selectedFiles.map((item, index) => (
              <div
                key={item.id}
                draggable={!isProcessing && !job}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(item.id)}
                onDragEnd={() => setDraggingId(null)}
                className={`rounded-[1.35rem] border bg-[#FAFAF9] p-3 text-left transition duration-200 dark:bg-white/[0.04] ${
                  draggingId === item.id
                    ? "scale-[0.98] border-[#F97316] opacity-60"
                    : "border-[#E7E5E4] hover:-translate-y-0.5 hover:border-[#FDBA74] dark:border-white/10 dark:hover:border-[#F97316]/60"
                } ${isProcessing || job ? "pointer-events-none opacity-80" : ""}`}
              >
                <div className="relative overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white dark:border-white/10 dark:bg-[#080B10]">
                  <div className="absolute left-3 top-3 z-10 rounded-full bg-[#F97316] px-2.5 py-1 text-xs font-black text-white shadow-lg">
                    {index + 1}
                  </div>

                  {!isProcessing && !job && (
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#78716C] shadow-lg transition hover:bg-red-50 hover:text-red-600 dark:bg-[#10151D]/95 dark:text-white/55 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      aria-label="Remove image"
                    >
                      <X size={16} />
                    </button>
                  )}

                  <div className="flex aspect-[4/4.7] items-center justify-center bg-[#FFF7ED] dark:bg-[#F97316]/10">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-2">
                  <button
                    type="button"
                    disabled={isProcessing || Boolean(job)}
                    className="mt-0.5 cursor-grab rounded-lg p-1 text-[#A8A29E] disabled:cursor-not-allowed disabled:opacity-50 active:cursor-grabbing dark:text-white/35"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical size={18} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#111827] dark:text-white">
                      {item.file.name}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
                      {formatFileSize(item.file.size)}
                    </p>

                    {!isProcessing && !job && (
                      <div className="mt-3 flex gap-2 sm:hidden">
                        <button
                          type="button"
                          onClick={() => moveFile(index, index - 1)}
                          disabled={index === 0}
                          className="rounded-full border border-[#E7E5E4] px-3 py-1.5 text-xs font-black text-[#57534E] disabled:opacity-40 dark:border-white/10 dark:text-white/55"
                        >
                          Up
                        </button>

                        <button
                          type="button"
                          onClick={() => moveFile(index, index + 1)}
                          disabled={index === selectedFiles.length - 1}
                          className="rounded-full border border-[#E7E5E4] px-3 py-1.5 text-xs font-black text-[#57534E] disabled:opacity-40 dark:border-white/10 dark:text-white/55"
                        >
                          Down
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isProcessing && (
            <ToolProcessingPanel
              title="Converting images to PDF"
              subtitle="FileGrip is placing your images into a PDF in the exact order shown above."
            />
          )}

          {job && (
            <ToolResultCard
              job={job}
              downloadLabel="Download PDF"
              resetLabel="Convert another image set"
              onReset={clearFiles}
            />
          )}

          {!job && (
            <button
              type="button"
              onClick={processFiles}
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
                  Convert {selectedFiles.length} Images to PDF
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
    </div>
  );
}