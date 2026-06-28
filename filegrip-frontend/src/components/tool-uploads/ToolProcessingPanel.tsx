"use client";

/** @format */

import { Loader2, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";

type ToolProcessingPanelProps = {
  title: string;
  subtitle?: string;
};

export default function ToolProcessingPanel({
  title,
  subtitle = "Please keep this page open while FileGrip prepares your secure download.",
}: ToolProcessingPanelProps) {
  return (
    <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED] p-5 dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
      <div className="flex items-start gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
          <Loader2 size={26} className="animate-spin" />
          <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-[#FDBA74]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-[#111827] dark:text-white">
            {title}
          </p>

          <p className="mt-1 text-sm font-bold leading-6 text-[#78716C] dark:text-white/55">
            {subtitle}
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-[#57534E] ring-1 ring-[#FED7AA]/70 dark:bg-white/[0.06] dark:text-white/60 dark:ring-white/10">
              <UploadCloud size={15} className="text-[#F97316]" />
              Uploading securely
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-[#57534E] ring-1 ring-[#FED7AA]/70 dark:bg-white/[0.06] dark:text-white/60 dark:ring-white/10">
              <Sparkles size={15} className="text-[#F97316]" />
              Processing file
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-[#57534E] ring-1 ring-[#FED7AA]/70 dark:bg-white/[0.06] dark:text-white/60 dark:ring-white/10">
              <ShieldCheck size={15} className="text-[#F97316]" />
              Preparing download
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white ring-1 ring-[#FED7AA]/70 dark:bg-white/10 dark:ring-white/10">
            <div className="fg-loader-bar h-full rounded-full bg-gradient-to-r from-[#FDBA74] via-[#F97316] to-[#EA580C]" />
          </div>
        </div>
      </div>
    </div>
  );
}