/** @format */

"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  EyeOff,
  FileText,
  Loader2,
  MousePointer2,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type RedactPdfUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type RedactionBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "new" | "move" | "resize";

type DragState = {
  mode: DragMode;
  id: string;
  startX: number;
  startY: number;
  startBox: RedactionBox;
};

type LimitModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant: "compress" | "split";
};

const minBoxSize = 1;
const minBoxWidth = 2;

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

function isPdf(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function normalizeBox(box: RedactionBox): RedactionBox {
  const width = clamp(box.width, minBoxWidth, 100);
  const height = clamp(box.height, minBoxSize, 100);
  const x = clamp(box.x, 0, 100 - width);
  const y = clamp(box.y, 0, 100 - height);

  return { ...box, x, y, width, height };
}

function makeBox(): RedactionBox {
  return {
    id: crypto.randomUUID(),
    x: 18,
    y: 22,
    width: 38,
    height: 8,
  };
}

export default function RedactPdfUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: RedactPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [boxes, setBoxes] = useState<RedactionBox[]>([makeBox()]);
  const [selectedBoxId, setSelectedBoxId] = useState<string>("");
  const [pageRange, setPageRange] = useState("1");
  const [redactionColor, setRedactionColor] = useState<"black" | "white">(
    "black",
  );
  const [confirmPermanent, setConfirmPermanent] = useState(false);
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

  const selectedBox = boxes.find((box) => box.id === selectedBoxId) ?? boxes[0];

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    if (boxes.length > 0 && !selectedBoxId) {
      setSelectedBoxId(boxes[0].id);
    }
  }, [boxes, selectedBoxId]);

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

  function pointToPercent(clientX: number, clientY: number) {
    const page = pageRef.current;

    if (!page) {
      return { x: 0, y: 0 };
    }

    const rect = page.getBoundingClientRect();

    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
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
        message: `"${file.name}" is bigger than our current upload limit. Compress it first, then return to redact it.`,
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!isPdf(file)) {
      setError("Redact PDF only accepts PDF files.");

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    const firstBox = makeBox();

    setSelectedFile(file);
    setPdfPreviewUrl(previewUrl);
    setPreviewZoom(1);
    setBoxes([firstBox]);
    setSelectedBoxId(firstBox.id);
    setConfirmPermanent(false);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);

    const firstBox = makeBox();

    setSelectedFile(null);
    setPdfPreviewUrl("");
    setPreviewZoom(1);
    setBoxes([firstBox]);
    setSelectedBoxId(firstBox.id);
    setPageRange("1");
    setRedactionColor("black");
    setConfirmPermanent(false);
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  }

  function addBox() {
    if (isProcessing || job) return;

    const nextBox = makeBox();

    setBoxes((current) => [...current, nextBox]);
    setSelectedBoxId(nextBox.id);
  }

  function removeBox(id: string) {
    if (isProcessing || job) return;

    setBoxes((current) => {
      const nextBoxes = current.filter((box) => box.id !== id);

      if (nextBoxes.length === 0) {
        const replacement = makeBox();
        setSelectedBoxId(replacement.id);
        return [replacement];
      }

      if (selectedBoxId === id) {
        setSelectedBoxId(nextBoxes[0].id);
      }

      return nextBoxes;
    });
  }

  function updateBox(id: string, updater: (box: RedactionBox) => RedactionBox) {
    setBoxes((current) =>
      current.map((box) => (box.id === id ? normalizeBox(updater(box)) : box)),
    );
  }

  function updateSelectedBox(
    key: keyof Omit<RedactionBox, "id">,
    value: string,
  ) {
    if (!selectedBox) return;

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) return;

    updateBox(selectedBox.id, (box) => ({
      ...box,
      [key]: numberValue,
    }));
  }

  function beginNewBox(event: React.PointerEvent<HTMLDivElement>) {
    if (isProcessing || job) return;

    const point = pointToPercent(event.clientX, event.clientY);

    const nextBox: RedactionBox = {
      id: crypto.randomUUID(),
      x: point.x,
      y: point.y,
      width: minBoxSize,
      height: minBoxSize,
    };

    setBoxes((current) => [...current, nextBox]);
    setSelectedBoxId(nextBox.id);

    dragStateRef.current = {
      mode: "new",
      id: nextBox.id,
      startX: point.x,
      startY: point.y,
      startBox: nextBox,
    };

    pageRef.current?.setPointerCapture(event.pointerId);
  }

  function beginBoxDrag(
    event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>,
    id: string,
    mode: DragMode,
  ) {
    if (isProcessing || job) return;

    event.preventDefault();
    event.stopPropagation();

    const point = pointToPercent(event.clientX, event.clientY);
    const box = boxes.find((item) => item.id === id);

    if (!box) return;

    setSelectedBoxId(id);

    dragStateRef.current = {
      mode,
      id,
      startX: point.x,
      startY: point.y,
      startBox: box,
    };

    pageRef.current?.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || isProcessing || job) return;

    const point = pointToPercent(event.clientX, event.clientY);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (dragState.mode === "new") {
      updateBox(dragState.id, () => {
        const x = Math.min(dragState.startX, point.x);
        const y = Math.min(dragState.startY, point.y);
        const width = Math.abs(point.x - dragState.startX);
        const height = Math.abs(point.y - dragState.startY);

        return {
          ...dragState.startBox,
          x,
          y,
          width: Math.max(width, minBoxSize),
          height: Math.max(height, minBoxSize),
        };
      });

      return;
    }

    if (dragState.mode === "move") {
      updateBox(dragState.id, () => ({
        ...dragState.startBox,
        x: dragState.startBox.x + deltaX,
        y: dragState.startBox.y + deltaY,
      }));

      return;
    }

    updateBox(dragState.id, () => ({
      ...dragState.startBox,
      width: dragState.startBox.width + deltaX,
      height: dragState.startBox.height + deltaY,
    }));
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragStateRef.current = null;

    try {
      pageRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }
  }

  function validate() {
    if (!selectedFile) return "Please choose a PDF first.";
    if (boxes.length < 1) return "Please add at least one redaction box.";
    if (pageRange.trim().length < 1) {
      return "Please enter a page number or range.";
    }

    const hasInvalidBox = boxes.some(
      (box) => box.width < minBoxSize || box.height < minBoxSize,
    );

    if (hasInvalidBox) {
      return "Every redaction box must be large enough to cover content.";
    }

    if (!confirmPermanent) {
      return "Please confirm you understand redaction is permanent.";
    }

    return "";
  }

  async function redactPdf() {
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
            page_range: pageRange,
            redaction_color: redactionColor,
            redaction_boxes: boxes.map((box) => ({
              x_percent: Number(box.x.toFixed(2)),
              y_percent: Number(box.y.toFixed(2)),
              width_percent: Number(box.width.toFixed(2)),
              height_percent: Number(box.height.toFixed(2)),
            })),
            confirmed_permanent_redaction: confirmPermanent,
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
          <EyeOff size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Redact PDF
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Draw redaction boxes directly on the uploaded PDF preview before
          sharing your document.
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
          {selectedFile ? "Choose another PDF" : "Select PDF"}
        </button>

        <p className="mt-4 text-xs font-medium text-[#78716C] dark:text-white/45">
          PDF supported · Max file size: {maxFileSizeMb ?? 25} MB
        </p>
      </div>

      {selectedFile && (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.75fr)]">
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
                  <MousePointer2 size={14} />
                  Drag on real PDF preview
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing || Boolean(job)}
                    onClick={() =>
                      setPreviewZoom((current) => clamp(current - 0.15, 0.7, 2))
                    }
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-white/15 disabled:opacity-50">
                    − Zoom
                  </button>

                  <div className="rounded-full bg-[#F97316] px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                    {Math.round(previewZoom * 100)}%
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing || Boolean(job)}
                    onClick={() =>
                      setPreviewZoom((current) => clamp(current + 0.15, 0.7, 2))
                    }
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-white/15 disabled:opacity-50">
                    + Zoom
                  </button>

                  <div className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                    {boxes.length} box{boxes.length === 1 ? "" : "es"}
                  </div>
                </div>
              </div>

              <div className="mx-auto h-[72vh] max-h-[720px] max-w-[860px] overflow-auto rounded-2xl bg-[#0B1220] p-3 sm:h-[620px]">
                <div
                  className="relative mx-auto aspect-[1/1.35] origin-top overflow-hidden rounded-xl bg-white shadow-2xl"
                  style={{
                    width: `${460 * previewZoom}px`,
                    maxWidth: "none",
                  }}>
                  {pdfPreviewUrl ? (
                    <iframe
                      title="PDF redaction live preview"
                      src={`${pdfPreviewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white text-sm font-black text-[#F97316]">
                      PDF preview loading...
                    </div>
                  )}

                  <div
                    ref={pageRef}
                    onPointerDown={beginNewBox}
                    onPointerMove={handlePointerMove}
                    onPointerUp={stopDrag}
                    onPointerCancel={stopDrag}
                    className="absolute inset-0 z-10 touch-none">
                    {boxes.map((box) => {
                      const isSelected = box.id === selectedBoxId;

                      return (
                        <div
                          key={box.id}
                          onPointerDown={(event) =>
                            beginBoxDrag(event, box.id, "move")
                          }
                          className={`absolute cursor-move border-2 ${
                            isSelected ? "border-[#F97316]" : "border-white/80"
                          } ${
                            redactionColor === "black" ? "bg-black" : "bg-white"
                          } shadow-[0_12px_30px_rgba(17,24,39,0.24)]`}
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                            minHeight: "2px",
                          }}>
                          <button
                            type="button"
                            aria-label="Resize redaction box"
                            onPointerDown={(event) =>
                              beginBoxDrag(event, box.id, "resize")
                            }
                            className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-[#F97316] shadow-lg"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-[11px] font-bold leading-5 text-white/55">
                Preview shows page 1. Drag on the document to create redaction
                boxes.
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={addBox}
                disabled={isProcessing || Boolean(job)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-3 text-xs font-black text-[#F97316] transition hover:-translate-y-0.5 disabled:opacity-50 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
                <Plus size={16} />
                Add box
              </button>

              <button
                type="button"
                onClick={() => selectedBox && removeBox(selectedBox.id)}
                disabled={isProcessing || Boolean(job) || boxes.length < 1}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] px-4 py-3 text-xs font-black text-[#57534E] transition hover:border-red-300 hover:text-red-600 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
                <Trash2 size={16} />
                Delete selected
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              Redaction settings
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              Position boxes over sensitive areas. Backend will apply these
              areas to the selected pages.
            </p>

            <div className="mt-5">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Page range
              </label>
              <input
                value={pageRange}
                disabled={isProcessing || Boolean(job)}
                onChange={(event) => setPageRange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                placeholder="1 or 1-3,5"
              />
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Redaction color
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRedactionColor("black")}
                  disabled={isProcessing || Boolean(job)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition disabled:opacity-50 ${
                    redactionColor === "black"
                      ? "border-[#111827] bg-[#111827] text-white"
                      : "border-[#E7E5E4] bg-white text-[#57534E] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                  }`}>
                  {redactionColor === "black" && <Check size={14} />}
                  Black
                </button>

                <button
                  type="button"
                  onClick={() => setRedactionColor("white")}
                  disabled={isProcessing || Boolean(job)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition disabled:opacity-50 ${
                    redactionColor === "white"
                      ? "border-[#F97316] bg-white text-[#F97316]"
                      : "border-[#E7E5E4] bg-white text-[#57534E] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                  }`}>
                  {redactionColor === "white" && <Check size={14} />}
                  White
                </button>
              </div>
            </div>

            {selectedBox && (
              <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Selected box position
                </label>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={Number(selectedBox.x.toFixed(1))}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) =>
                      updateSelectedBox("x", event.target.value)
                    }
                    className="rounded-2xl border border-[#E7E5E4] bg-white px-3 py-3 text-sm font-black text-[#111827] outline-none focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                    placeholder="X %"
                  />

                  <input
                    type="number"
                    value={Number(selectedBox.y.toFixed(1))}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) =>
                      updateSelectedBox("y", event.target.value)
                    }
                    className="rounded-2xl border border-[#E7E5E4] bg-white px-3 py-3 text-sm font-black text-[#111827] outline-none focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                    placeholder="Y %"
                  />

                  <input
                    type="number"
                    value={Number(selectedBox.width.toFixed(1))}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) =>
                      updateSelectedBox("width", event.target.value)
                    }
                    className="rounded-2xl border border-[#E7E5E4] bg-white px-3 py-3 text-sm font-black text-[#111827] outline-none focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                    placeholder="Width %"
                  />

                  <input
                    type="number"
                    value={Number(selectedBox.height.toFixed(1))}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) =>
                      updateSelectedBox("height", event.target.value)
                    }
                    className="rounded-2xl border border-[#E7E5E4] bg-white px-3 py-3 text-sm font-black text-[#111827] outline-none focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                    placeholder="Height %"
                  />
                </div>
              </div>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
              <input
                type="checkbox"
                checked={confirmPermanent}
                disabled={isProcessing || Boolean(job)}
                onChange={(event) => setConfirmPermanent(event.target.checked)}
                className="mt-0.5 h-5 w-5 accent-[#F97316]"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-black text-red-700 dark:text-red-300">
                  <ShieldAlert size={16} />I understand redaction is permanent
                </span>
                <span className="mt-1 block text-xs font-bold leading-5 text-red-600/80 dark:text-red-200/70">
                  Real redaction should permanently remove or cover content, not
                  just hide it visually.
                </span>
              </span>
            </label>

            {isProcessing && (
              <ToolProcessingPanel
                title="Redacting PDF"
                subtitle="FileGrip is applying permanent redaction boxes to your PDF."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Redacted PDF"
                  resetLabel="Redact another PDF"
                  onReset={clearFile}
                />
              </div>
            )}

            {!job && (
              <button
                type="button"
                onClick={redactPdf}
                disabled={isProcessing}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60">
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Redacting...
                  </>
                ) : (
                  <>
                    <EyeOff size={18} />
                    Redact PDF
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
