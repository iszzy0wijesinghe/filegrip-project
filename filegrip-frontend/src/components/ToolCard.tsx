import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Tool } from "../lib/api";

export default function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group relative overflow-hidden rounded-[1.75rem] border border-[#E7E5E4] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#FDBA74] hover:shadow-[0_22px_50px_rgba(249,115,22,0.12)] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-[#F97316]/70"
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#FFF7ED] opacity-0 transition group-hover:opacity-100 dark:bg-[#F97316]/10" />

      <div className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA]/60 dark:bg-[#F97316]/10 dark:ring-[#F97316]/20">
        <FileText size={23} />
      </div>

      <div className="relative flex items-start justify-between gap-3">
        <h3 className="text-lg font-black text-[#111827] dark:text-white">
          {tool.name}
        </h3>

        {tool.is_premium && (
          <span className="rounded-full bg-[#111827] px-2 py-1 text-xs font-bold text-white dark:bg-[#F97316]">
            Advanced
          </span>
        )}
      </div>

      <p className="relative mt-3 min-h-12 text-sm leading-6 text-[#78716C] dark:text-white/55">
        {tool.short_description}
      </p>

      <div className="relative mt-5 inline-flex items-center gap-2 text-sm font-black text-[#F97316]">
        Open tool
        <ArrowRight size={16} className="transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}