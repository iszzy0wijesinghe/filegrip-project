/** @format */

import { Sparkles } from "lucide-react";

type PublicDemoNoticeProps = {
  compact?: boolean;
};

export default function PublicDemoNotice({
  compact = false,
}: PublicDemoNoticeProps) {
  return (
    <div className="rounded-[1.35rem] border border-[#FED7AA] bg-[#FFF7ED]/85 px-4 py-3 shadow-[0_14px_35px_rgba(249,115,22,0.08)] backdrop-blur dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-white shadow-[0_10px_22px_rgba(249,115,22,0.22)]">
          <Sparkles size={16} />
        </div>

        <div>
          <p className="text-sm font-black text-[#111827] dark:text-white">
            Public demo access
          </p>
          <p
            className={`mt-1 font-bold leading-5 text-[#78716C] dark:text-white/60 ${
              compact ? "text-[11px]" : "text-xs"
            }`}
          >
            All current FileGrip tools are included during the public demo for
            up to 3 months. Pro plans will be introduced later for advanced and
            enhanced features.
          </p>
        </div>
      </div>
    </div>
  );
}