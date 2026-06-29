"use client";

/** @format */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  GripHorizontal,
  Loader2,
  RotateCcw,
  Shuffle,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type ReorderPdfPagesUploadProps = {
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

const MAX_REORDER_PDF_PAGES = 30;

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
      const viewport = page.getViewport({ scale: 0.28 });

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

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

export default function ReorderPdfPagesUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: ReorderPdfPagesUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([]);
  const [orderedPages, setOrderedPages] = useState<PagePreview[]>([]);
  const [draggedPageNumber, setDraggedPageNumber] = useState<number | null>(
    null,
  );
  const [dragOverPageNumber, setDragOverPageNumber] = useState<number | null>(
    null,
  );
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

  const pageOrderText = useMemo(() => {
    return orderedPages.map((page) => page.pageNumber).join(",");
  }, [orderedPages]);

  const hasChangedOrder = useMemo(() => {
    return orderedPages.some((page, index) => page.pageNumber !== index + 1);
  }, [orderedPages]);

  const canProcess =
    Boolean(selectedFile) &&
    orderedPages.length > 0 &&
    hasChangedOrder &&
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
      setError("Reorder PDF Pages only accepts PDF files.");
      return;
    }

    setSelectedFile(file);
    setPageCount(null);
    setPagePreviews([]);
    setOrderedPages([]);
    setDraggedPageNumber(null);
    setDragOverPageNumber(null);
    setIsPreviewing(true);

    const previewResult = await createPdfPagePreviews(file);

    if (
      previewResult.pageCount &&
      previewResult.pageCount > MAX_REORDER_PDF_PAGES
    ) {
      setSelectedFile(null);
      setPageCount(null);
      setPagePreviews([]);
      setOrderedPages([]);
      setDraggedPageNumber(null);
      setDragOverPageNumber(null);
      setIsPreviewing(false);

      setLimitModal({
        isOpen: true,
        title: "Hey Homie, this PDF has too many pages.",
        message:
          "Reorder PDF Pages currently supports up to 30 pages at once. Split this PDF into smaller parts first, then reorder pages in batches.",
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
    setOrderedPages(previewResult.pages);
    setIsPreviewing(false);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function resetUpload() {
    setSelectedFile(null);
    setPageCount(null);
    setPagePreviews([]);
    setOrderedPages([]);
    setDraggedPageNumber(null);
    setDragOverPageNumber(null);
    setIsPreviewing(false);
    setIsProcessing(false);
    setJob(null);
    setError("");
  }

  function resetOrder() {
    setOrderedPages(pagePreviews);
    setDraggedPageNumber(null);
    setDragOverPageNumber(null);
    setError("");
    setJob(null);
  }

  function movePageLeft(index: number) {
    if (index <= 0) return;

    setOrderedPages((pages) => moveItem(pages, index, index - 1));
    setJob(null);
    setError("");
  }

  function movePageRight(index: number) {
    if (index >= orderedPages.length - 1) return;

    setOrderedPages((pages) => moveItem(pages, index, index + 1));
    setJob(null);
    setError("");
  }

  function movePageToStart(index: number) {
    if (index <= 0) return;

    setOrderedPages((pages) => moveItem(pages, index, 0));
    setJob(null);
    setError("");
  }

  function movePageToEnd(index: number) {
    if (index >= orderedPages.length - 1) return;

    setOrderedPages((pages) => moveItem(pages, index, pages.length - 1));
    setJob(null);
    setError("");
  }

  function handleDragStart(pageNumber: number) {
    if (isProcessing) return;

    setDraggedPageNumber(pageNumber);
    setDragOverPageNumber(null);
    setError("");
    setJob(null);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(pageNumber: number) {
    if (isProcessing || draggedPageNumber === null) return;

    setDragOverPageNumber(pageNumber);
  }

  function handleDrop(targetPageNumber: number) {
    if (isProcessing || draggedPageNumber === null) return;

    setOrderedPages((pages) => {
      const fromIndex = pages.findIndex(
        (page) => page.pageNumber === draggedPageNumber,
      );
      const toIndex = pages.findIndex(
        (page) => page.pageNumber === targetPageNumber,
      );

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return pages;
      }

      return moveItem(pages, fromIndex, toIndex);
    });

    setDraggedPageNumber(null);
    setDragOverPageNumber(null);
    setJob(null);
    setError("");
  }

  function handleDragEnd() {
    setDraggedPageNumber(null);
    setDragOverPageNumber(null);
  }

  async function processFile() {
    if (!selectedFile) {
      setError("Please choose a PDF first.");
      return;
    }

    if (!hasChangedOrder) {
      setError("Move at least one page before processing.");
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
            page_order: pageOrderText,
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
          <Shuffle size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Upload PDF to reorder pages
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#78716C] dark:text-white/60">
          Reorder pages by dragging cards, then download a clean PDF in your new
          page order.
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
          {MAX_REORDER_PDF_PAGES}
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
                    Pages
                  </p>
                  <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                    {pageCount ?? "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-3 dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]/70 dark:text-orange-200/60">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-black text-[#9A3412] dark:text-orange-100">
                    {hasChangedOrder ? "Changed" : "Original"}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-500/20 dark:bg-green-500/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green-600/70 dark:text-green-300/60">
                    Output
                  </p>
                  <p className="mt-1 text-sm font-black text-green-700 dark:text-green-200">
                    PDF file
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
                Building page preview
              </p>
              <p className="mt-1 text-xs font-bold text-[#78716C] dark:text-white/45">
                FileGrip is preparing every page so you can reorder visually.
              </p>
            </div>
          )}

          {!isPreviewing && orderedPages.length > 0 && !job && (
            <>
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED] p-3 sm:p-4 dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-white">
                      Reorder pages
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/45">
                      Drag and drop pages into the order you want. Arrow buttons
                      are also available for precise movement.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hasChangedOrder && (
                      <button
                        type="button"
                        onClick={resetOrder}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-3 py-2 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                      >
                        <RotateCcw size={14} />
                        Reset order
                      </button>
                    )}

                    <div className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#57534E] ring-1 ring-[#E7E5E4] dark:bg-white/[0.04] dark:text-white/60 dark:ring-white/10">
                      {orderedPages.length} pages
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
                  {orderedPages.map((page, index) => {
                    const isChanged = page.pageNumber !== index + 1;
                    const isDragging = draggedPageNumber === page.pageNumber;
                    const isDropTarget =
                      dragOverPageNumber === page.pageNumber &&
                      draggedPageNumber !== null &&
                      draggedPageNumber !== page.pageNumber;

                    return (
                      <div
                        key={`${page.pageNumber}-${index}`}
                        draggable={!isProcessing}
                        onDragStart={() => handleDragStart(page.pageNumber)}
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(page.pageNumber)}
                        onDrop={() => handleDrop(page.pageNumber)}
                        onDragEnd={handleDragEnd}
                        className={`group overflow-hidden rounded-[0.95rem] border bg-white p-1.5 transition sm:rounded-[1rem] dark:bg-white/[0.06] ${
                          isChanged
                            ? "border-[#F97316] shadow-[0_10px_22px_rgba(249,115,22,0.12)] dark:border-[#F97316]/50"
                            : "border-[#E7E5E4] dark:border-white/10"
                        } ${
                          isDropTarget
                            ? "scale-[1.02] ring-2 ring-[#F97316] ring-offset-1 ring-offset-[#FFF7ED] dark:ring-offset-[#111827]"
                            : ""
                        } ${
                          isDragging
                            ? "scale-95 cursor-grabbing opacity-45"
                            : "cursor-grab active:cursor-grabbing"
                        }`}
                      >
                        <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-[#FFF7ED] dark:bg-[#F97316]/10">
                          {page.previewUrl ? (
                            <img
                              src={page.previewUrl}
                              alt={`Page ${page.pageNumber}`}
                              className="h-full w-full object-contain p-0.5 sm:p-1"
                              draggable={false}
                            />
                          ) : (
                            <FileText size={22} className="text-[#F97316]" />
                          )}

                          <div className="absolute left-1 top-1 rounded-full bg-[#F97316] px-1 py-0.5 text-[7px] font-black text-white sm:px-1.5 sm:text-[8px]">
                            {index + 1}
                          </div>

                          <div className="absolute right-1 top-1 rounded-full bg-[#111827] px-1 py-0.5 text-[7px] font-black text-white sm:px-1.5 sm:text-[8px] dark:bg-white dark:text-[#111827]">
                            P{page.pageNumber}
                          </div>

                          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white/95 px-1 py-0.5 text-[7px] font-black text-[#57534E] shadow-sm sm:px-1.5 sm:text-[8px] dark:bg-[#111827] dark:text-white">
                            <GripHorizontal size={10} />
                            Drag
                          </div>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => movePageLeft(index)}
                            disabled={isProcessing || index === 0}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E5E4] text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-35 sm:h-7 sm:w-7 dark:border-white/10 dark:text-white/60"
                            aria-label="Move page left"
                          >
                            <ArrowLeft size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => movePageToStart(index)}
                            disabled={isProcessing || index === 0}
                            className="hidden h-7 items-center justify-center rounded-full border border-[#E7E5E4] px-2 text-[9px] font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-35 lg:flex dark:border-white/10 dark:text-white/60"
                            aria-label="Move page to start"
                          >
                            Start
                          </button>

                          <button
                            type="button"
                            onClick={() => movePageRight(index)}
                            disabled={
                              isProcessing || index === orderedPages.length - 1
                            }
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E7E5E4] text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-35 sm:h-7 sm:w-7 dark:border-white/10 dark:text-white/60"
                            aria-label="Move page right"
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => movePageToEnd(index)}
                          disabled={
                            isProcessing || index === orderedPages.length - 1
                          }
                          className="mt-1 w-full rounded-full bg-[#FAFAF9] px-1.5 py-1 text-[8px] font-black text-[#57534E] ring-1 ring-[#E7E5E4] transition hover:text-[#F97316] disabled:cursor-not-allowed disabled:opacity-35 sm:text-[9px] dark:bg-white/[0.06] dark:text-white/55 dark:ring-white/10"
                        >
                          End
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 min-w-0 overflow-hidden rounded-[1.5rem] border border-green-200 bg-green-50 p-4 dark:border-green-500/20 dark:bg-green-500/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-green-900 dark:text-green-100">
                      Final order preview
                    </p>
                    <p className="mt-1 text-xs font-bold text-green-700 dark:text-green-300">
                      This is the exact page order that will be exported.
                    </p>
                  </div>

                  <div className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-green-700 ring-1 ring-green-200 dark:bg-white/[0.06] dark:text-green-200 dark:ring-green-500/20">
                    {hasChangedOrder ? "Ready" : "No changes"}
                  </div>
                </div>

                <div className="mt-4 max-w-full overflow-x-auto overflow-y-hidden pb-3">
                  <div className="flex w-max gap-3">
                    {orderedPages.map((page, index) => (
                      <div
                        key={`final-${page.pageNumber}-${index}`}
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
                            Old {page.pageNumber}
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

              {hasChangedOrder && (
                <div className="mt-5 overflow-hidden rounded-2xl bg-white px-4 py-3 text-xs font-bold text-[#78716C] ring-1 ring-[#E7E5E4] dark:bg-white/[0.04] dark:text-white/45 dark:ring-white/10">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <span className="shrink-0 font-black text-[#57534E] dark:text-white/55">
                      Page order:
                    </span>

                    <span className="max-h-20 overflow-y-auto break-all rounded-xl bg-[#FAFAF9] px-3 py-2 font-black leading-5 text-[#111827] dark:bg-white/[0.06] dark:text-white sm:max-h-24">
                      {pageOrderText}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {isProcessing && (
            <ToolProcessingPanel
              title="Reordering your PDF"
              subtitle="FileGrip is rebuilding your PDF with the new page order."
            />
          )}

          {job && (
            <div ref={resultRef}>
              <ToolResultCard
                job={job}
                selectedFileSize={selectedFile.size}
                downloadLabel="Download reordered PDF"
                resetLabel="Reorder another PDF"
                onReset={resetUpload}
              />
            </div>
          )}

          {!job && !isPreviewing && orderedPages.length > 0 && (
            <button
              type="button"
              onClick={processFile}
              disabled={!canProcess}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Reordering pages...
                </>
              ) : (
                <>
                  <Shuffle size={18} />
                  Reorder PDF
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