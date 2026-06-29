/** @format */

"use client";

/** @format */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Eraser,
  FileText,
  Image as ImageIcon,
  Loader2,
  MousePointer2,
  PenLine,
  Signature,
  Type,
  Upload,
  X,
} from "lucide-react";
import { createFileJob, FileJobResponse } from "../../lib/fileJobsApi";
import ToolProcessingPanel from "./ToolProcessingPanel";
import ToolResultCard from "./ToolResultCard";
import ToolLimitModal from "./ToolLimitModal";

type SignPdfUploadProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

type SignatureMode = "draw" | "type" | "upload";

type SignaturePosition = {
  x: number;
  y: number;
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
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

export default function SignPdfUpload({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: SignPdfUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const signatureImageInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [brushSize, setBrushSize] = useState(3);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("draw");
  const [typedSignature, setTypedSignature] = useState("Your Signature");
  const [uploadedSignatureUrl, setUploadedSignatureUrl] = useState("");
  const [uploadedSignatureFile, setUploadedSignatureFile] =
    useState<File | null>(null);
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition>(
    {
      x: 52,
      y: 72,
    },
  );
  const [signatureSize, setSignatureSize] = useState(34);
  const [pageRange, setPageRange] = useState("1");
  const [isDraggingSignature, setIsDraggingSignature] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
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
    return () => {
      if (uploadedSignatureUrl) URL.revokeObjectURL(uploadedSignatureUrl);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [uploadedSignatureUrl, pdfPreviewUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    context.lineWidth = brushSize;
  }, [signatureMode, brushSize]);

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
        message: `"${file.name}" is bigger than our current upload limit. Compress it first, then return to sign it.`,
        actionLabel: "Compress PDF",
        actionHref: "/tools/compress-pdf",
        variant: "compress",
      });

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (!isPdf(file)) {
      setError("Sign PDF only accepts PDF files.");

      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setPdfPreviewUrl(previewUrl);
    setPreviewZoom(1);

    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    if (uploadedSignatureUrl) URL.revokeObjectURL(uploadedSignatureUrl);

    setSelectedFile(null);
    setPdfPreviewUrl("");
    setPreviewZoom(1);
    setBrushSize(3);
    setSignatureMode("draw");
    setTypedSignature("Your Signature");
    setUploadedSignatureUrl("");
    setUploadedSignatureFile(null);
    setSignaturePosition({ x: 52, y: 72 });
    setSignatureSize(34);
    setPageRange("1");
    setIsDraggingSignature(false);
    setHasDrawnSignature(false);
    clearCanvas();
    setIsProcessing(false);
    setJob(null);
    setError("");

    if (inputRef.current) inputRef.current.value = "";
    if (signatureImageInputRef.current) {
      signatureImageInputRef.current.value = "";
    }
  }

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isProcessing || job) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);

    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || isProcessing || job) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawnSignature(true);
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;

    try {
      canvasRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  }

  function handleSignatureImage(file: File | null) {
    setError("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Signature upload only accepts image files.");
      return;
    }

    if (uploadedSignatureUrl) URL.revokeObjectURL(uploadedSignatureUrl);

    const url = URL.createObjectURL(file);

    setUploadedSignatureUrl(url);
    setUploadedSignatureFile(file);

    if (signatureImageInputRef.current) {
      signatureImageInputRef.current.value = "";
    }
  }

  function startSignatureDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (isProcessing || job) return;

    event.preventDefault();
    setIsDraggingSignature(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSignatureDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingSignature || isProcessing || job) return;

    const preview = previewRef.current;
    if (!preview) return;

    const rect = preview.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setSignaturePosition({
      x: Math.min(Math.max(x, 8), 92),
      y: Math.min(Math.max(y, 8), 92),
    });
  }

  function stopSignatureDrag(event: React.PointerEvent<HTMLDivElement>) {
    setIsDraggingSignature(false);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }
  }

  function getSignaturePayload() {
    if (signatureMode === "draw") {
      const canvas = canvasRef.current;
      return canvas?.toDataURL("image/png") ?? "";
    }

    if (signatureMode === "type") {
      return typedSignature.trim();
    }

    return uploadedSignatureUrl ? "uploaded-signature" : "";
  }

  function validate() {
    if (!selectedFile) return "Please choose a PDF first.";

    if (signatureMode === "draw" && !hasDrawnSignature) {
      return "Please draw your signature first.";
    }

    if (signatureMode === "type" && typedSignature.trim().length < 1) {
      return "Please type your signature.";
    }

    if (signatureMode === "upload" && !uploadedSignatureFile) {
      return "Please upload a signature image.";
    }

    if (pageRange.trim().length < 1) {
      return "Please enter a page number or range.";
    }

    return "";
  }

  async function signPdf() {
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
      const files = uploadedSignatureFile
        ? [selectedFile, uploadedSignatureFile]
        : [selectedFile];

      const [result] = await Promise.all([
        createFileJob({
          toolSlug,
          files,
          settings: {
            signature_mode: signatureMode,
            signature_value: getSignaturePayload(),
            signature_position_x: signaturePosition.x,
            signature_position_y: signaturePosition.y,
            signature_size: signatureSize,
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

  function renderSignaturePreview() {
    if (signatureMode === "draw") {
      return (
        <canvas
          width={480}
          height={160}
          ref={(node) => {
            if (!node) return;

            const sourceCanvas = canvasRef.current;

            if (!sourceCanvas || node === sourceCanvas) return;

            const context = node.getContext("2d");
            if (!context) return;

            context.clearRect(0, 0, node.width, node.height);
            context.drawImage(sourceCanvas, 0, 0, node.width, node.height);
          }}
          className="h-full w-full"
        />
      );
    }

    if (signatureMode === "upload" && uploadedSignatureUrl) {
      return (
        <img
          src={uploadedSignatureUrl}
          alt="Signature preview"
          className="h-full w-full object-contain"
        />
      );
    }

    return (
      <span
        className="font-serif italic leading-none text-[#111827]"
        style={{ fontSize: `${signatureSize * 0.72}px` }}>
        {typedSignature || "Your Signature"}
      </span>
    );
  }

  return (
    <div className="rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-5 text-center sm:p-6 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Signature size={24} />
        </div>

        <h2 className="text-2xl font-black text-[#111827] dark:text-white">
          Sign PDF
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#78716C] dark:text-white/60">
          Draw, type, or upload your signature and place it exactly where it
          should appear on the uploaded PDF preview.
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
                  Drag signature on real PDF preview
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing || Boolean(job)}
                    onClick={() =>
                      setPreviewZoom((current) => Math.max(0.7, current - 0.15))
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
                      setPreviewZoom((current) => Math.min(2, current + 0.15))
                    }
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-white/15 disabled:opacity-50">
                    + Zoom
                  </button>

                  <div className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white sm:text-xs">
                    Page {pageRange || "1"}
                  </div>
                </div>
              </div>

              <div className="mx-auto h-[72vh] max-h-[720px] max-w-[860px] overflow-auto rounded-2xl bg-[#0B1220] p-3 sm:h-[620px]">
                <div
                  ref={previewRef}
                  className="relative mx-auto aspect-[1/1.35] origin-top overflow-hidden rounded-xl bg-white shadow-2xl"
                  style={{
                    width: `${460 * previewZoom}px`,
                    maxWidth: "none",
                  }}>
                  {pdfPreviewUrl ? (
                    <iframe
                      title="PDF signature live preview"
                      src={`${pdfPreviewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white text-sm font-black text-[#F97316]">
                      PDF preview loading...
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-white/0" />

                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={startSignatureDrag}
                    onPointerMove={handleSignatureDrag}
                    onPointerUp={stopSignatureDrag}
                    onPointerCancel={stopSignatureDrag}
                    className="absolute z-10 flex cursor-move items-center justify-center rounded-xl border-2 border-[#F97316] bg-white/85 p-2 shadow-[0_14px_35px_rgba(17,24,39,0.22)] backdrop-blur"
                    style={{
                      left: `${signaturePosition.x}%`,
                      top: `${signaturePosition.y}%`,
                      width: `${Math.max(110, signatureSize * 4.2 * previewZoom)}px`,
                      height: `${Math.max(42, signatureSize * 1.25 * previewZoom)}px`,
                      transform: "translate(-50%, -50%)",
                    }}>
                    {renderSignaturePreview()}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-center text-[11px] font-bold leading-5 text-white/55">
                Preview shows page 1. Drag your signature to position it before
                processing.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E7E5E4] bg-white p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-sm font-black text-[#111827] dark:text-white">
              Signature settings
            </p>
            <p className="mt-1 text-xs font-medium text-[#78716C] dark:text-white/45">
              Create your signature and position it on the PDF preview.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["draw", "Draw", PenLine],
                ["type", "Type", Type],
                ["upload", "Upload", ImageIcon],
              ].map(([mode, label, Icon]) => {
                const ModeIcon = Icon as typeof PenLine;

                return (
                  <button
                    key={String(mode)}
                    type="button"
                    disabled={isProcessing || Boolean(job)}
                    onClick={() => setSignatureMode(mode as SignatureMode)}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      signatureMode === mode
                        ? "border-[#F97316] bg-[#F97316] text-white"
                        : "border-[#E7E5E4] bg-[#FAFAF9] text-[#57534E] hover:border-[#F97316] hover:text-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                    }`}>
                    <ModeIcon size={16} />
                    {String(label)}
                  </button>
                );
              })}
            </div>

            {signatureMode === "draw" && (
              <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                    Draw signature
                  </p>

                  <button
                    type="button"
                    onClick={clearCanvas}
                    disabled={isProcessing || Boolean(job)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E4] bg-white px-3 py-1.5 text-xs font-black text-[#57534E] transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
                    <Eraser size={14} />
                    Clear
                  </button>
                </div>

                <canvas
                  ref={canvasRef}
                  width={720}
                  height={220}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  className="h-[150px] w-full touch-none rounded-2xl border border-[#E7E5E4] bg-white dark:border-white/10"
                />

                <div className="mt-3 rounded-2xl border border-[#E7E5E4] bg-white p-3 dark:border-white/10 dark:bg-[#080B10]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                      Brush thickness
                    </label>
                    <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-black text-[#F97316] dark:bg-[#F97316]/10">
                      {brushSize}px
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={brushSize}
                    disabled={isProcessing || Boolean(job)}
                    onChange={(event) =>
                      setBrushSize(Number(event.target.value))
                    }
                    className="mt-3 w-full accent-[#F97316]"
                  />
                </div>
              </div>
            )}

            {signatureMode === "type" && (
              <div className="mt-4">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                  Typed signature
                </label>
                <input
                  value={typedSignature}
                  disabled={isProcessing || Boolean(job)}
                  onChange={(event) => setTypedSignature(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 font-serif text-xl italic text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                  placeholder="Your Signature"
                />
              </div>
            )}

            {signatureMode === "upload" && (
              <div className="mt-4">
                <input
                  ref={signatureImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    handleSignatureImage(event.target.files?.[0] ?? null)
                  }
                />

                <button
                  type="button"
                  onClick={() => signatureImageInputRef.current?.click()}
                  disabled={isProcessing || Boolean(job)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] px-4 py-4 text-sm font-black text-[#F97316] transition hover:-translate-y-0.5 disabled:opacity-50 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
                  <ImageIcon size={18} />
                  {uploadedSignatureFile
                    ? "Replace signature image"
                    : "Upload signature image"}
                </button>

                {uploadedSignatureFile && (
                  <p className="mt-2 truncate text-xs font-bold text-[#78716C] dark:text-white/45">
                    {uploadedSignatureFile.name}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 rounded-[1.25rem] border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Signature size · {signatureSize}px
              </label>
              <input
                type="range"
                min={20}
                max={72}
                value={signatureSize}
                disabled={isProcessing || Boolean(job)}
                onChange={(event) =>
                  setSignatureSize(Number(event.target.value))
                }
                className="mt-4 w-full accent-[#F97316]"
              />
            </div>

            <div className="mt-4">
              <label className="text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                Page
              </label>
              <input
                value={pageRange}
                disabled={isProcessing || Boolean(job)}
                onChange={(event) => setPageRange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#F97316] dark:border-white/10 dark:bg-[#080B10] dark:text-white"
                placeholder="1 or 1-3"
              />
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/75 p-4 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#F97316]">
                <Check size={15} />
                Placement preview
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-[#78716C] dark:text-white/55">
                Drag the signature on the real PDF preview. Backend will use
                these relative coordinates when placing it on the PDF.
              </p>
            </div>

            {isProcessing && (
              <ToolProcessingPanel
                title="Signing PDF"
                subtitle="FileGrip is applying your signature to the selected PDF page."
              />
            )}

            {job && (
              <div ref={resultRef}>
                <ToolResultCard
                  job={job}
                  downloadLabel="Download Signed PDF"
                  resetLabel="Sign another PDF"
                  onReset={clearFile}
                />
              </div>
            )}

            {!job && (
              <button
                type="button"
                onClick={signPdf}
                disabled={isProcessing}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3.5 text-sm font-black text-white shadow-[0_16px_35px_rgba(249,115,22,0.22)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60">
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Signature size={18} />
                    Sign PDF
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
