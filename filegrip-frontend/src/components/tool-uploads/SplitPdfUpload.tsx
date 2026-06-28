/** @format */

"use client";

/** @format */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  FileText,
  Layers,
  Loader2,
  PackageOpen,
  Plus,
  Scissors,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";

type SplitPdfUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type SplitMode = "ranges" | "every_page" | "every_n_pages";

type FilePreview = {
  previewUrl: string | null;
  pageCount: number | null;
};

type RangePreviewMap = Record<string, string | null>;

type PageRange = {
  id: string;
  start: number;
  end: number;
  source: "manual" | "auto";
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

function createRangeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function rangeToText(range: PageRange) {
  return range.start === range.end
    ? `${range.start}`
    : `${range.start}-${range.end}`;
}

function getRangeLabel(range: PageRange) {
  if (range.source === "auto") {
    return `Remaining pages ${rangeToText(range)}`;
  }

  return `Pages ${rangeToText(range)}`;
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

async function createPdfPagePreview(
  file: File,
  pageNumber: number,
): Promise<string | null> {
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

    const safePageNumber = Math.min(Math.max(pageNumber, 1), pdf.numPages);
    const page = await pdf.getPage(safePageNumber);
    const viewport = page.getViewport({ scale: 0.35 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export default function SplitPdfUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: SplitPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview>({
    previewUrl: null,
    pageCount: null,
  });
  const [rangePreviews, setRangePreviews] = useState<RangePreviewMap>({});
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>("ranges");
  const [manualRanges, setManualRanges] = useState<PageRange[]>([]);
  const [startPage, setStartPage] = useState("1");
  const [endPage, setEndPage] = useState("");
  const [pagesPerFile, setPagesPerFile] = useState("2");
  const [isProcessing, setIsProcessing] = useState(false);
  const [job, setJob] = useState<FileJobResponse | null>(null);
  const [error, setError] = useState("");

  const acceptedTypes = inputTypes
    ?.map((type) => `.${type.toLowerCase()}`)
    .join(",");

  const effectiveRanges = useMemo(() => {
    if (!preview.pageCount || manualRanges.length === 0) {
      return manualRanges;
    }

    const sortedRanges = [...manualRanges].sort((a, b) => a.start - b.start);
    const lastManualEnd = Math.max(...sortedRanges.map((range) => range.end));

    if (lastManualEnd >= preview.pageCount) {
      return sortedRanges;
    }

    return [
      ...sortedRanges,
      {
        id: "auto-remaining-pages",
        start: lastManualEnd + 1,
        end: preview.pageCount,
        source: "auto" as const,
      },
    ];
  }, [manualRanges, preview.pageCount]);

  const rangeString = effectiveRanges.map(rangeToText).join(", ");

  useEffect(() => {
    if (!selectedFile || effectiveRanges.length === 0) return;

    const fileForPreview = selectedFile;
    let isMounted = true;

    async function buildRangePreviews() {
      const nextPreviews: RangePreviewMap = {};

      for (const range of effectiveRanges) {
        const previewKey = `${range.start}-${range.end}`;

        if (rangePreviews[previewKey] !== undefined) {
          continue;
        }

        const previewUrl = await createPdfPagePreview(
          fileForPreview,
          range.start,
        );

        if (!isMounted) return;

        nextPreviews[previewKey] = previewUrl;
      }

      if (isMounted && Object.keys(nextPreviews).length > 0) {
        setRangePreviews((current) => ({
          ...current,
          ...nextPreviews,
        }));
      }
    }

    buildRangePreviews();

    return () => {
      isMounted = false;
    };
  }, [selectedFile, effectiveRanges, rangePreviews]);

  useEffect(() => {
    return () => {
      if (preview.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(preview.previewUrl);
      }
    };
  }, [preview.previewUrl]);

  async function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      setError(`"${file.name}" is larger than ${maxFileSizeMb} MB.`);
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Split PDF only accepts PDF files.");
      return;
    }

    setSelectedFile(file);
    setManualRanges([]);
    setRangePreviews({});
    setStartPage("1");
    setEndPage("");
    setPreview({
      previewUrl: null,
      pageCount: null,
    });
    setIsPreviewing(true);

    const nextPreview = await createPdfPreview(file);

    setPreview(nextPreview);
    setEndPage(nextPreview.pageCount ? String(nextPreview.pageCount) : "");
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
    setSplitMode("ranges");
    setManualRanges([]);
    setRangePreviews({});
    setStartPage("1");
    setEndPage("");
    setPagesPerFile("2");
    setIsProcessing(false);
    setJob(null);
    setError("");
  }

  function addManualRange() {
    setError("");

    const start = Number(startPage);
    const end = Number(endPage);
    const pageCount = preview.pageCount;

    if (!pageCount) {
      setError("Page count is still loading. Please wait a moment.");
      return;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      setError("Start page and end page must be whole numbers.");
      return;
    }

    if (start < 1 || end < 1) {
      setError("Start page and end page must be greater than 0.");
      return;
    }

    if (start > end) {
      setError("Start page cannot be higher than end page.");
      return;
    }

    if (end > pageCount) {
      setError(`End page cannot be higher than ${pageCount}.`);
      return;
    }

    const overlaps = manualRanges.some(
      (range) => start <= range.end && end >= range.start,
    );

    if (overlaps) {
      setError("This range overlaps with an existing range.");
      return;
    }

    const nextRanges = [
      ...manualRanges,
      {
        id: createRangeId(),
        start,
        end,
        source: "manual" as const,
      },
    ].sort((a, b) => a.start - b.start);

    setManualRanges(nextRanges);

    const nextStart = end + 1;

    if (nextStart <= pageCount) {
      setStartPage(String(nextStart));
      setEndPage(String(pageCount));
    } else {
      setStartPage("");
      setEndPage("");
    }
  }

  function removeManualRange(id: string) {
    setManualRanges((ranges) => ranges.filter((range) => range.id !== id));
    setError("");
  }

  function validateBeforeProcess() {
    if (!selectedFile) {
      return "Please choose a PDF first.";
    }

    if (splitMode === "ranges" && effectiveRanges.length === 0) {
      return "Please add at least one page range.";
    }

    if (splitMode === "every_n_pages") {
      const value = Number(pagesPerFile);

      if (!Number.isInteger(value) || value < 1) {
        return "Pages per file must be a whole number greater than 0.";
      }
    }

    return "";
  }

  async function processFile() {
    const validationError = validateBeforeProcess();

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
            split_mode: splitMode,
            ranges: splitMode === "ranges" ? rangeString : undefined,
            pages_per_file:
              splitMode === "every_n_pages" ? Number(pagesPerFile) : undefined,
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
          <Scissors size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Upload PDF to split
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#78716C] dark:text-white/60">
          Split one PDF into multiple PDFs and download everything as a ZIP
          file.
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
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]">
          <Upload size={18} />
          {selectedFile ? "Replace PDF" : "Select PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="overflow-hidden rounded-[1.35rem] border border-[#E7E5E4] bg-[#FFF7ED] dark:border-white/10 dark:bg-[#F97316]/10 lg:sticky lg:top-24 lg:self-start">
              <div className="relative flex h-[280px] items-center justify-center sm:h-[320px] lg:h-[340px]">
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
                        Output
                      </p>
                      <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
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
                  aria-label="Remove file">
                  <X size={17} />
                </button>
              </div>

              {!job && (
                <div className="mt-5">
                  <p className="text-sm font-black text-[#111827] dark:text-white">
                    Choose split method
                  </p>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setSplitMode("ranges")}
                      disabled={isProcessing}
                      className={`rounded-[1.25rem] border p-4 text-left transition ${
                        splitMode === "ranges"
                          ? "border-[#F97316] bg-[#FFF7ED] text-[#111827] dark:bg-[#F97316]/10 dark:text-white"
                          : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.035] dark:text-white/60"
                      }`}>
                      <Scissors size={20} className="text-[#F97316]" />
                      <p className="mt-3 text-sm font-black">Custom ranges</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                        Add start and end pages as clean split parts.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSplitMode("every_page")}
                      disabled={isProcessing}
                      className={`rounded-[1.25rem] border p-4 text-left transition ${
                        splitMode === "every_page"
                          ? "border-[#F97316] bg-[#FFF7ED] text-[#111827] dark:bg-[#F97316]/10 dark:text-white"
                          : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.035] dark:text-white/60"
                      }`}>
                      <PackageOpen size={20} className="text-[#F97316]" />
                      <p className="mt-3 text-sm font-black">Every page</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                        Create one PDF for each page.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSplitMode("every_n_pages")}
                      disabled={isProcessing}
                      className={`rounded-[1.25rem] border p-4 text-left transition ${
                        splitMode === "every_n_pages"
                          ? "border-[#F97316] bg-[#FFF7ED] text-[#111827] dark:bg-[#F97316]/10 dark:text-white"
                          : "border-[#E7E5E4] bg-white text-[#57534E] hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.035] dark:text-white/60"
                      }`}>
                      <Layers size={20} className="text-[#F97316]" />
                      <p className="mt-3 text-sm font-black">Every X pages</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                        Example: every 2 pages.
                      </p>
                    </button>
                  </div>

                  {splitMode === "ranges" && (
                    <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.035]">
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                        <div>
                          <p className="text-sm font-black text-[#111827] dark:text-white">
                            Add split parts
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                            Enter a start page and end page. FileGrip will add
                            the remaining pages as the next part automatically.
                          </p>
                        </div>

                        {preview.pageCount && (
                          <div className="rounded-full bg-[#FFF7ED] px-3 py-1.5 text-xs font-black text-[#F97316] ring-1 ring-[#FDBA74]/70 dark:bg-[#F97316]/10 dark:ring-[#F97316]/30">
                            1 to {preview.pageCount} pages
                          </div>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                            Start page
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={preview.pageCount ?? undefined}
                            value={startPage}
                            onChange={(event) =>
                              setStartPage(event.target.value)
                            }
                            placeholder="1"
                            className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                            End page
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={preview.pageCount ?? undefined}
                            value={endPage}
                            onChange={(event) => setEndPage(event.target.value)}
                            placeholder={
                              preview.pageCount
                                ? String(preview.pageCount)
                                : "20"
                            }
                            className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={addManualRange}
                          disabled={isProcessing}
                          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(249,115,22,0.2)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-7">
                          <Plus size={17} />
                          Add part
                        </button>
                      </div>

                      {effectiveRanges.length > 0 && (
                        <div className="mt-5">
                          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                                Split output parts
                              </p>
                              <p className="mt-1 text-xs font-bold text-[#78716C] dark:text-white/45">
                                Each card below will become a separate PDF
                                inside your ZIP.
                              </p>
                            </div>

                            <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#57534E] ring-1 ring-[#E7E5E4] dark:bg-white/[0.06] dark:text-white/60 dark:ring-white/10">
                              {effectiveRanges.length} output files
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {effectiveRanges.map((range, index) => {
                              const pageTotal = range.end - range.start + 1;

                              return (
                                <div
                                  key={range.id}
                                  className={`overflow-hidden rounded-[1.25rem] border bg-white p-3 transition dark:bg-white/[0.04] ${
                                    range.source === "auto"
                                      ? "border-green-200 dark:border-green-500/20"
                                      : "border-[#FDBA74] dark:border-[#F97316]/30"
                                  }`}>
                                  <div className="flex gap-3">
                                    <div className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E7E5E4] bg-[#FFF7ED] dark:border-white/10 dark:bg-[#F97316]/10">
                                      {(() => {
                                        const previewKey = `${range.start}-${range.end}`;
                                        const batchPreviewUrl =
                                          rangePreviews[previewKey];

                                        if (batchPreviewUrl) {
                                          return (
                                            <img
                                              src={batchPreviewUrl}
                                              alt={`Part ${index + 1} preview`}
                                              className="h-full w-full object-contain p-1.5"
                                            />
                                          );
                                        }

                                        return (
                                          <div className="flex flex-col items-center text-[#F97316]">
                                            <Loader2
                                              size={20}
                                              className="animate-spin"
                                            />
                                            <span className="mt-1 text-[9px] font-black">
                                              Page {range.start}
                                            </span>
                                          </div>
                                        );
                                      })()}

                                      <div className="absolute left-1.5 top-1.5 rounded-full bg-[#F97316] px-1.5 py-0.5 text-[9px] font-black text-white">
                                        P{range.start}
                                      </div>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-black text-[#111827] dark:text-white">
                                            Part {index + 1}
                                          </p>
                                          <p className="mt-1 text-xs font-bold text-[#78716C] dark:text-white/45">
                                            Pages {rangeToText(range)}
                                          </p>
                                        </div>

                                        {range.source === "manual" && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeManualRange(range.id)
                                            }
                                            disabled={isProcessing}
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-[#78716C] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white/55"
                                            aria-label="Remove range">
                                            <X size={13} />
                                          </button>
                                        )}
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-black text-[#9A3412] ring-1 ring-[#FDBA74]/70 dark:bg-[#F97316]/10 dark:text-orange-200 dark:ring-[#F97316]/30">
                                          {pageTotal}{" "}
                                          {pageTotal === 1 ? "page" : "pages"}
                                        </span>

                                        <span
                                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${
                                            range.source === "auto"
                                              ? "bg-green-50 text-green-700 ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/20"
                                              : "bg-white text-[#57534E] ring-[#E7E5E4] dark:bg-white/[0.06] dark:text-white/60 dark:ring-white/10"
                                          }`}>
                                          {range.source === "auto"
                                            ? "Auto remaining"
                                            : "Manual"}
                                        </span>
                                      </div>

                                      <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                                        {range.source === "auto"
                                          ? "FileGrip automatically keeps the leftover pages as the final split part."
                                          : "This range was added manually using start and end pages."}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-[#78716C] ring-1 ring-[#E7E5E4] dark:bg-white/[0.04] dark:text-white/45 dark:ring-white/10">
                            Will send ranges:{" "}
                            <span className="font-black text-[#111827] dark:text-white">
                              {rangeString}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {splitMode === "every_n_pages" && (
                    <div className="mt-5">
                      <label className="text-sm font-black text-[#111827] dark:text-white">
                        Pages per file
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={pagesPerFile}
                        onChange={(event) =>
                          setPagesPerFile(event.target.value)
                        }
                        placeholder="2"
                        className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-bold text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <ToolProcessingPanel
                  title="Splitting your PDF"
                  subtitle="FileGrip is creating separated PDF files and packaging them into one ZIP download."
                />
              )}

              {job && (
                <ToolResultCard
                  job={job}
                  selectedFileSize={selectedFile.size}
                  downloadLabel="Download split ZIP"
                  resetLabel="Split another PDF"
                  onReset={resetUpload}
                />
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
                      Splitting...
                    </>
                  ) : (
                    <>
                      <Scissors size={18} />
                      Split PDF into ZIP
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
    </div>
  );
}
