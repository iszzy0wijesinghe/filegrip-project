"use client";

/** @format */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type DeletePdfPagesUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type PagePreview = {
  pageNumber: number;
  previewUrl: string | null;
};

type PdfPreviewResult = {
  pageCount: number | null;
  pages: PagePreview[];
};

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
};

const MAX_DELETE_PDF_PAGES = 30;

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

function compressPagesToRangeText(pages: number[]) {
  if (pages.length === 0) return "";

  const sortedPages = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];

  let start = sortedPages[0];
  let previous = sortedPages[0];

  for (let index = 1; index < sortedPages.length; index++) {
    const current = sortedPages[index];

    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = current;
    previous = current;
  }

  ranges.push(start === previous ? String(start) : `${start}-${previous}`);

  return ranges.join(", ");
}

function parsePageRangeInput(input: string, pageCount: number): number[] {
  const value = input.trim();

  if (!value) {
    throw new Error("Enter pages or ranges to delete.");
  }

  const chunks = value
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    throw new Error("Enter pages or ranges to delete.");
  }

  const pages = new Set<number>();

  for (const chunk of chunks) {
    if (/^\d+$/.test(chunk)) {
      const page = Number(chunk);

      if (page < 1 || page > pageCount) {
        throw new Error(`Page ${page} is outside the PDF page count.`);
      }

      pages.add(page);
      continue;
    }

    const rangeMatch = chunk.match(/^(\d+)\s*-\s*(\d+)$/);

    if (!rangeMatch) {
      throw new Error(`Invalid range: ${chunk}`);
    }

    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    if (start < 1 || end < 1) {
      throw new Error("Page numbers must be greater than 0.");
    }

    if (start > end) {
      throw new Error(`Invalid range: ${chunk}`);
    }

    if (end > pageCount) {
      throw new Error(`Range ${chunk} is outside the PDF page count.`);
    }

    for (let page = start; page <= end; page++) {
      pages.add(page);
    }
  }

  return [...pages].sort((a, b) => a - b);
}

async function createPdfPagePreviews(file: File): Promise<PdfPreviewResult> {
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

    const pages: PagePreview[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.3 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        pages.push({
          pageNumber,
          previewUrl: null,
        });
        continue;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      pages.push({
        pageNumber,
        previewUrl: canvas.toDataURL("image/png"),
      });
    }

    return {
      pageCount: pdf.numPages,
      pages,
    };
  } catch {
    return {
      pageCount: null,
      pages: [],
    };
  }
}

export default function DeletePdfPagesUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: DeletePdfPagesUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([]);
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [rangeInput, setRangeInput] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
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

  const deletedPageText = useMemo(
    () => compressPagesToRangeText(deletedPages),
    [deletedPages],
  );

  const keptPages = useMemo(() => {
    return pagePreviews.filter(
      (page) => !deletedPages.includes(page.pageNumber),
    );
  }, [deletedPages, pagePreviews]);

  const removedPages = useMemo(() => {
    return pagePreviews.filter((page) =>
      deletedPages.includes(page.pageNumber),
    );
  }, [deletedPages, pagePreviews]);

  const canProcess =
    Boolean(selectedFile) &&
    deletedPages.length > 0 &&
    keptPages.length > 0 &&
    !isProcessing;

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

  async function handleFile(file: File | null) {
    setError("");
    setJob(null);

    if (!file) return;

    const maxBytes = (maxFileSizeMb ?? 25) * 1024 * 1024;

    if (file.size > maxBytes) {
      setLimitModal({
        isOpen: true,
        title: "Hey Homie, mmm... this file is too large.",
        message:
          "Your file is bigger than our maximum upload limit. Try our Compress PDF tool to reduce the file size, then come back and retry.",
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Delete PDF Pages only accepts PDF files.");
      return;
    }

    setSelectedFile(file);
    setPageCount(null);
    setPagePreviews([]);
    setDeletedPages([]);
    setRangeInput("");
    setIsPreviewing(true);

    const previewResult = await createPdfPagePreviews(file);

    if (
      previewResult.pageCount &&
      previewResult.pageCount > MAX_DELETE_PDF_PAGES
    ) {
      setSelectedFile(null);
      setPageCount(null);
      setPagePreviews([]);
      setDeletedPages([]);
      setRangeInput("");
      setIsPreviewing(false);

      setLimitModal({
        isOpen: true,
        title: "Hey Homie, this PDF has too many pages.",
        message:
          "Delete PDF Pages currently supports up to 30 pages at once. Split this PDF into smaller parts first, then delete pages in batches.",
        actionLabel: "Split PDF",
        actionHref: "/tools/split-pdf",
        variant: "split",
      });

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setPageCount(previewResult.pageCount);
    setPagePreviews(previewResult.pages);
    setIsPreviewing(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetUpload() {
    setSelectedFile(null);
    setPageCount(null);
    setPagePreviews([]);
    setDeletedPages([]);
    setRangeInput("");
    setIsPreviewing(false);
    setIsProcessing(false);
    setJob(null);
    setError("");
  }

  function toggleDeletedPage(pageNumber: number) {
    setError("");
    setJob(null);

    setDeletedPages((currentPages) => {
      if (currentPages.includes(pageNumber)) {
        return currentPages.filter((page) => page !== pageNumber);
      }

      if (pageCount && currentPages.length >= pageCount - 1) {
        setError("You must keep at least one page in the final PDF.");
        return currentPages;
      }

      return [...currentPages, pageNumber].sort((a, b) => a - b);
    });
  }

  function applyRangeInput() {
    setError("");
    setJob(null);

    if (!pageCount) {
      setError("Page count is still loading. Please wait a moment.");
      return;
    }

    try {
      const pagesFromInput = parsePageRangeInput(rangeInput, pageCount);
      const mergedPages = [
        ...new Set([...deletedPages, ...pagesFromInput]),
      ].sort((a, b) => a - b);

      if (mergedPages.length >= pageCount) {
        setError("You must keep at least one page in the final PDF.");
        return;
      }

      setDeletedPages(mergedPages);
      setRangeInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid page range.");
    }
  }

  function restoreAllPages() {
    setDeletedPages([]);
    setRangeInput("");
    setError("");
  }

  async function processFile() {
    if (!selectedFile) {
      setError("Please choose a PDF first.");
      return;
    }

    if (deletedPages.length === 0) {
      setError("Please select at least one page to delete.");
      return;
    }

    if (keptPages.length === 0) {
      setError("You must keep at least one page in the final PDF.");
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
            delete_pages: deletedPageText,
          },
        }),
        wait(2400),
      ]);

      setJob(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-3 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-8 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Trash2 size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Upload PDF to delete pages
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#78716C] dark:text-white/60">
          Select pages visually, use single pages or ranges, preview what will
          stay, and download a clean PDF.
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
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
        >
          <Upload size={18} />
          {selectedFile ? "Replace PDF" : "Select PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          Max file size: {maxFileSizeMb ?? 25} MB · Max pages:{" "}
          {MAX_DELETE_PDF_PAGES}
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 rounded-[1.5rem] border border-[#E7E5E4] bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] sm:flex dark:bg-[#F97316]/10">
              <FileText size={26} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-[#111827] dark:text-white">
                {selectedFile.name}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                    File size
                  </p>
                  <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-3 dark:border-white/10 dark:bg-white/[0.035]">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#A8A29E] dark:text-white/35">
                    Total pages
                  </p>
                  <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                    {pageCount ?? "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-500/70 dark:text-red-300/60">
                    Deleted
                  </p>
                  <p className="mt-1 text-sm font-black text-red-700 dark:text-red-200">
                    {deletedPages.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green-600/70 dark:text-green-300/60">
                    Final pages
                  </p>
                  <p className="mt-1 text-sm font-black text-green-700 dark:text-green-200">
                    {keptPages.length || "—"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetUpload}
              disabled={isProcessing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] text-[#78716C] transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-white/55"
              aria-label="Remove file"
            >
              <X size={17} />
            </button>
          </div>

          {isPreviewing && (
            <div className="mt-5 rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED] p-5 text-center dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
              <Loader2
                size={28}
                className="mx-auto animate-spin text-[#F97316]"
              />
              <p className="mt-3 text-sm font-black text-[#111827] dark:text-white">
                Building full PDF preview
              </p>
              <p className="mt-1 text-xs font-bold text-[#78716C] dark:text-white/45">
                FileGrip is preparing every page so you can select pages
                visually.
              </p>
            </div>
          )}

          {!isPreviewing && pagePreviews.length > 0 && !job && (
            <>
              <div className="mt-5 rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED] p-3 sm:p-4 dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#111827] dark:text-white">
                      Delete pages by range
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                      Use single pages or multiple ranges. Example:{" "}
                      <span className="font-black text-[#F97316]">
                        2, 5, 8-12, 20
                      </span>
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-[560px]">
                    <input
                      type="text"
                      value={rangeInput}
                      onChange={(event) => setRangeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyRangeInput();
                        }
                      }}
                      disabled={isProcessing}
                      placeholder="e.g. 2, 5, 8-12"
                      className="min-w-0 flex-1 rounded-2xl border border-[#FDBA74] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition placeholder:text-[#A8A29E] focus:border-[#F97316] dark:border-[#F97316]/30 dark:bg-white/[0.06] dark:text-white"
                    />

                    <button
                      type="button"
                      onClick={applyRangeInput}
                      disabled={isProcessing || !rangeInput.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(249,115,22,0.2)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={17} />
                      Add range
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#E7E5E4] bg-[#FAFAF9] p-3 sm:p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-white">
                      Full PDF preview
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                      Scroll horizontally and click pages you want to delete.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {deletedPages.length > 0 && (
                      <button
                        type="button"
                        onClick={restoreAllPages}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                      >
                        <RotateCcw size={14} />
                        Restore all
                      </button>
                    )}

                    <div className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#57534E] ring-1 ring-[#E7E5E4] dark:bg-white/[0.04] dark:text-white/60 dark:ring-white/10">
                      {pagePreviews.length} pages
                    </div>
                  </div>
                </div>

                <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-3">
                  <div className="flex w-max gap-3">
                    {pagePreviews.map((page) => {
                      const isDeleted = deletedPages.includes(page.pageNumber);

                      return (
                        <button
                          key={page.pageNumber}
                          type="button"
                          onClick={() => toggleDeletedPage(page.pageNumber)}
                          disabled={isProcessing}
                          className={`group relative w-[104px] shrink-0 overflow-hidden rounded-[1.1rem] border p-2 text-left transition sm:w-[118px] ${
                            isDeleted
                              ? "border-red-300 bg-red-50 opacity-80 dark:border-red-500/30 dark:bg-red-500/10"
                              : "border-[#E7E5E4] bg-white hover:-translate-y-0.5 hover:border-[#FDBA74] dark:border-white/10 dark:bg-white/[0.04]"
                          }`}
                        >
                          <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-2xl bg-[#FFF7ED] sm:h-[150px] dark:bg-[#F97316]/10">
                            {page.previewUrl ? (
                              <img
                                src={page.previewUrl}
                                alt={`Page ${page.pageNumber}`}
                                className={`h-full w-full object-contain p-1.5 transition ${
                                  isDeleted
                                    ? "scale-95 grayscale"
                                    : "group-hover:scale-[1.03]"
                                }`}
                              />
                            ) : (
                              <FileText size={28} className="text-[#F97316]" />
                            )}

                            {isDeleted && (
                              <div className="absolute inset-0 flex items-center justify-center bg-red-600/18 backdrop-blur-[1px]">
                                <div className="rounded-full bg-red-600 p-2 text-white shadow-lg">
                                  <Trash2 size={18} />
                                </div>
                              </div>
                            )}

                            {!isDeleted && (
                              <div className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-[#57534E] opacity-0 shadow-sm transition group-hover:opacity-100 dark:bg-[#111827] dark:text-white">
                                <Trash2 size={14} />
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p
                              className={`text-xs font-black ${
                                isDeleted
                                  ? "text-red-700 dark:text-red-200"
                                  : "text-[#111827] dark:text-white"
                              }`}
                            >
                              Page {page.pageNumber}
                            </p>

                            {isDeleted ? (
                              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white">
                                Delete
                              </span>
                            ) : (
                              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-black text-green-700 ring-1 ring-green-200 dark:bg-green-500/10 dark:text-green-300 dark:ring-green-500/20">
                                Keep
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid min-w-0 gap-4">
                <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-green-200 bg-green-50 p-4 dark:border-green-500/20 dark:bg-green-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-green-900 dark:text-green-100">
                        Preview after deletion
                      </p>
                      <p className="mt-1 text-xs font-bold text-green-700 dark:text-green-300">
                        These pages will remain in your final PDF.
                      </p>
                    </div>

                    <div className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-green-700 ring-1 ring-green-200 dark:bg-white/[0.06] dark:text-green-200 dark:ring-green-500/20">
                      {keptPages.length} kept
                    </div>
                  </div>

                  <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-3">
                    <div className="flex w-max gap-3">
                      {keptPages.map((page, index) => (
                        <div
                          key={page.pageNumber}
                          className="w-[104px] shrink-0 rounded-[1.15rem] border border-green-200 bg-white p-2 dark:border-green-500/20 dark:bg-white/[0.06] sm:w-[116px]"
                        >
                          <div className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-2xl bg-green-50 dark:bg-green-500/10 sm:h-[148px]">
                            {page.previewUrl ? (
                              <img
                                src={page.previewUrl}
                                alt={`Final page ${index + 1}`}
                                className="h-full w-full object-contain p-1.5"
                              />
                            ) : (
                              <FileText size={24} className="text-green-600" />
                            )}

                            <div className="absolute left-1.5 top-1.5 rounded-full bg-green-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                              {index + 1}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-1">
                            <p className="truncate text-[11px] font-black text-green-800 dark:text-green-100">
                              Page {page.pageNumber}
                            </p>
                            <CheckCircle2
                              size={13}
                              className="shrink-0 text-green-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={`min-w-0 overflow-hidden rounded-[1.5rem] p-4 ${
                    removedPages.length > 0
                      ? "border border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10"
                      : "border border-[#E7E5E4] bg-[#FAFAF9] dark:border-white/10 dark:bg-white/[0.035]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-black ${
                          removedPages.length > 0
                            ? "text-red-900 dark:text-red-100"
                            : "text-[#111827] dark:text-white"
                        }`}
                      >
                        Deleted page stack
                      </p>
                      <p
                        className={`mt-1 text-xs font-bold ${
                          removedPages.length > 0
                            ? "text-red-700 dark:text-red-300"
                            : "text-[#78716C] dark:text-white/45"
                        }`}
                      >
                        Removed pages appear here. Scroll horizontally after 3
                        cards.
                      </p>
                    </div>

                    <div
                      className={`shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black ring-1 dark:bg-white/[0.06] ${
                        removedPages.length > 0
                          ? "text-red-700 ring-red-200 dark:text-red-200 dark:ring-red-500/20"
                          : "text-[#57534E] ring-[#E7E5E4] dark:text-white/60 dark:ring-white/10"
                      }`}
                    >
                      {removedPages.length}
                    </div>
                  </div>

                  {removedPages.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#E7E5E4] bg-white/70 p-5 text-center dark:border-white/10 dark:bg-white/[0.04]">
                      <Trash2 size={24} className="mx-auto text-[#A8A29E]" />
                      <p className="mt-2 text-xs font-black text-[#78716C] dark:text-white/50">
                        No pages selected yet
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-3">
                      <div className="flex w-max gap-3">
                        {removedPages.map((page) => (
                          <button
                            key={page.pageNumber}
                            type="button"
                            onClick={() => toggleDeletedPage(page.pageNumber)}
                            disabled={isProcessing}
                            className="group w-[150px] shrink-0 rounded-[1.2rem] border border-red-200 bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-red-300 dark:border-red-500/20 dark:bg-white/[0.06]"
                          >
                            <div className="relative flex h-[120px] items-center justify-center overflow-hidden rounded-2xl bg-red-50 dark:bg-red-500/10">
                              {page.previewUrl ? (
                                <img
                                  src={page.previewUrl}
                                  alt={`Deleted page ${page.pageNumber}`}
                                  className="h-full w-full object-contain p-1.5 grayscale transition group-hover:scale-[1.03]"
                                />
                              ) : (
                                <FileText size={24} className="text-red-500" />
                              )}

                              <div className="absolute inset-0 flex items-center justify-center bg-red-600/12">
                                <div className="rounded-full bg-red-600 p-2 text-white shadow-lg">
                                  <Trash2 size={16} />
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-red-800 dark:text-red-100">
                                  Page {page.pageNumber}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-bold text-red-600 dark:text-red-300">
                                  Click to restore
                                </p>
                              </div>

                              <X size={14} className="shrink-0 text-red-500" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {deletedPages.length > 0 && (
                <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-[#78716C] ring-1 ring-[#E7E5E4] dark:bg-white/[0.04] dark:text-white/45 dark:ring-white/10">
                  Pages to delete:{" "}
                  <span className="font-black text-[#111827] dark:text-white">
                    {deletedPageText}
                  </span>
                </div>
              )}
            </>
          )}

          {isProcessing && (
            <ToolProcessingPanel
              title="Deleting selected pages"
              subtitle="FileGrip is creating a clean PDF without the selected pages."
            />
          )}

          {job && (
            <div ref={resultRef}>
              <ToolResultCard
                job={job}
                selectedFileSize={selectedFile.size}
                downloadLabel="Download cleaned PDF"
                resetLabel="Delete pages from another PDF"
                onReset={resetUpload}
              />
            </div>
          )}

          {!job && !isPreviewing && pagePreviews.length > 0 && (
            <button
              type="button"
              onClick={processFile}
              disabled={!canProcess}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Deleting pages...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete selected pages
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