"use client";

/** @format */

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";

type ToolLimitModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  variant?: "compress" | "split";
  onClose: () => void;
};

export default function ToolLimitModal({
  isOpen,
  title,
  message,
  actionLabel,
  actionHref,
  variant = "compress",
  onClose,
}: ToolLimitModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const tipText =
    variant === "split"
      ? "Split the PDF into smaller parts first, then return to continue this tool in batches."
      : "Compress the file first, then return here and upload the smaller version.";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[2147483647] flex min-h-dvh items-center justify-center bg-[#111827]/72 px-4 py-5 backdrop-blur-[18px]">
        <button
          type="button"
          aria-label="Close popup overlay"
          onClick={onClose}
          className="absolute inset-0 cursor-default"
        />

        <div className="fg-limit-modal relative z-10 w-full max-w-[430px] overflow-hidden rounded-[1.7rem] border border-[#FED7AA] bg-white shadow-[0_35px_120px_rgba(17,24,39,0.42)] sm:max-w-[500px] sm:rounded-[2.1rem] dark:border-[#F97316]/35 dark:bg-[#111827]">
          <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#F97316]/22 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-[#FDBA74]/24 blur-3xl" />

          <div className="relative p-4 sm:p-6">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E7E5E4] bg-white/80 text-[#78716C] shadow-sm transition hover:-translate-y-0.5 hover:border-[#F97316] hover:text-[#F97316] sm:h-10 sm:w-10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55"
                aria-label="Close popup"
              >
                <X size={17} />
              </button>
            </div>

            <h3 className="-mt-1 text-xl font-black leading-[1.12] text-[#111827] sm:text-[1.7rem] dark:text-white">
              {title}
            </h3>

            <p className="mt-3 text-sm font-bold leading-6 text-[#78716C] sm:mt-4 dark:text-white/60">
              {message}
            </p>

            <div className="mt-4 rounded-[1.25rem] border border-[#FED7AA] bg-[#FFF7ED]/70 p-3 sm:mt-5 dark:border-[#F97316]/20 dark:bg-[#F97316]/10">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#F97316]">
                FileGrip tip
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-[#78716C] dark:text-white/55">
                {tipText}
              </p>
            </div>

            <div className="mt-5 grid gap-2.5 sm:mt-6 sm:grid-cols-[1fr_auto] sm:gap-3">
              <Link
                href={actionHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-[0_18px_38px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] sm:py-3.5"
              >
                {actionLabel}
                <ArrowRight size={17} />
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-[#E7E5E4] bg-white px-5 py-3 text-sm font-black text-[#57534E] transition hover:-translate-y-0.5 hover:border-[#F97316] hover:text-[#F97316] sm:py-3.5 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
              >
                I’ll retry
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fg-limit-modal-pop {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
            filter: blur(8px);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        .fg-limit-modal {
          animation: fg-limit-modal-pop 0.28s cubic-bezier(0.16, 1, 0.3, 1)
            both;
        }
      `}</style>
    </>,
    document.body,
  );
}