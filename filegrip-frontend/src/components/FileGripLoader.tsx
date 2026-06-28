/** @format */

"use client";

import { useEffect, useState } from "react";
import { FileText, ShieldCheck, Sparkles } from "lucide-react";
import BrandLogo from "./BrandLogo";

type FileGripLoaderProps = {
  label?: string;
  fullScreen?: boolean;
  minTimeMs?: number;
};

const loadingSteps = [
  "Preparing secure workspace...",
  "Checking file tools...",
  "Warming up FileGrip...",
  "Almost ready...",
];

export default function FileGripLoader({
  label,
  fullScreen = false,
  minTimeMs = 1200,
}: FileGripLoaderProps) {
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setStep((current) => (current + 1) % loadingSteps.length);
    }, 700);

    const readyTimer = window.setTimeout(() => {
      setReady(true);
    }, minTimeMs);

    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(readyTimer);
    };
  }, [minTimeMs]);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${
        fullScreen
          ? "min-h-screen bg-[#FAFAF9] px-5 dark:bg-[#080B10]"
          : "min-h-[360px]"
      }`}
    >
      <div className="fg-soft-grid absolute inset-0 opacity-35 dark:opacity-20" />
      <div className="fg-ambient left-[18%] top-[18%] opacity-60" />
      <div className="fg-ambient bottom-[12%] right-[16%] opacity-40" />

      <div className="relative w-full max-w-[420px]">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-7 text-center shadow-[0_28px_90px_rgba(17,24,39,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#FDBA74] to-transparent opacity-80" />

          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-[2rem] bg-[#F97316]/15 blur-xl" />
            <div className="fg-logo-orbit absolute inset-0 rounded-[2rem] border border-[#FED7AA] dark:border-[#F97316]/30" />

            <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED] text-[#F97316] shadow-inner dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
              <FileText size={34} />
            </div>

            <div className="fg-file-chip absolute -right-1 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#F97316] shadow-lg dark:bg-[#10151D]">
              <ShieldCheck size={16} />
            </div>

            <div className="fg-file-chip-delayed absolute -bottom-1 -left-1 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#F97316] shadow-lg dark:bg-[#10151D]">
              <Sparkles size={16} />
            </div>
          </div>

          <div className="flex justify-center">
            <BrandLogo variant="auto" size="md" href="" />
          </div>

          <p className="mt-5 text-sm font-bold text-[#78716C] dark:text-white/55">
            {label || loadingSteps[step]}
          </p>

          <div className="mx-auto mt-6 h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-[#FFF7ED] ring-1 ring-[#FED7AA]/60 dark:bg-white/10 dark:ring-white/10">
            <div className="fg-loader-bar h-full rounded-full bg-gradient-to-r from-[#FDBA74] via-[#F97316] to-[#EA580C]" />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#A8A29E] dark:text-white/35">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                ready ? "bg-[#22C55E]" : "bg-[#F97316]"
              }`}
            />
            Files, Firmly Handled
          </div>
        </div>
      </div>
    </div>
  );
}