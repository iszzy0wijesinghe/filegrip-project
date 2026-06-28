import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Zap,
} from "lucide-react";
import Header from "../src/components/Header";
import Footer from "../src/components/Footer";
import ToolCard from "../src/components/ToolCard";
import BrandLogo from "../src/components/BrandLogo";
import { getTools } from "../src/lib/api";

export default async function Home() {
  const tools = await getTools();
  const featuredTools = tools.slice(0, 8);

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-[#111827] dark:bg-[#080B10] dark:text-white">
      <Header />

      <section className="relative overflow-hidden px-5 py-16 sm:px-6 lg:py-24">
        <div className="fg-ambient left-[10%] top-10 opacity-60" />
        <div className="fg-ambient bottom-[8%] right-[8%] opacity-35" />
        <div className="fg-soft-grid absolute inset-0 opacity-40 dark:opacity-25" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C2410C] shadow-sm dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
              <Sparkles size={16} />
              Files, Firmly Handled.
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-[#111827] sm:text-5xl md:text-6xl lg:text-7xl dark:text-white">
              Fast, private tools for every file.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[#78716C] sm:text-lg dark:text-white/60">
              Convert, compress, edit, merge, split, and protect PDFs,
              documents, and images with smooth online tools built for
              productivity, privacy, and trust.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/tools"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-7 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-[#EA580C]"
              >
                Explore Tools
                <ArrowRight size={18} />
              </Link>

              <Link
                href="/privacy"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-7 py-4 text-sm font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#F97316] hover:bg-[#FFF7ED] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-[#F97316]/10"
              >
                <ShieldCheck size={18} />
                Privacy First
              </Link>
            </div>

            <div className="mt-8 grid gap-3 text-sm font-semibold text-[#57534E] sm:grid-cols-3 dark:text-white/55">
              {[
                "No signup for basic tools",
                "Auto-delete files",
                "Fast processing",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-2xl border border-[#E7E5E4] bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <CheckCircle2 className="shrink-0 text-[#22C55E]" size={18} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-[#F97316]/10 blur-3xl" />

            <div className="relative rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_28px_90px_rgba(17,24,39,0.12)] backdrop-blur-xl sm:p-6 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <div className="rounded-[1.5rem] border-2 border-dashed border-[#FDBA74] bg-[#FFF7ED] p-7 text-center sm:p-9 dark:border-[#F97316]/50 dark:bg-[#F97316]/10">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-lg shadow-orange-500/25">
                  <UploadCloud size={32} />
                </div>

                <div className="flex justify-center">
                  <BrandLogo variant="auto" size="md" href="" />
                </div>

                <h2 className="mt-5 text-2xl font-black text-[#111827] dark:text-white">
                  Choose a tool. Upload. Download.
                </h2>

                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#78716C] dark:text-white/60">
                  FileGrip keeps each file workflow clean and simple, from PDF
                  merge to document conversion.
                </p>

                <Link
                  href="/tools/merge-pdf"
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#111827] px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#F97316] dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
                >
                  Try Merge PDF
                  <ArrowRight size={17} />
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                {[
                  { label: "Fast", icon: Zap },
                  { label: "Secure", icon: Lock },
                  { label: "Private", icon: ShieldCheck },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[#E7E5E4] bg-[#FAFAF9] p-4 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <item.icon className="mx-auto text-[#F97316]" size={22} />
                    <p className="mt-2 font-black text-[#111827] dark:text-white">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:py-16">
        <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-black text-[#F97316]">Popular tools</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl dark:text-white">
              Essential tools, ready to use.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#78716C] sm:text-base dark:text-white/55">
              Start with the most-used FileGrip tools for PDFs, documents, and
              image workflows.
            </p>
          </div>

          <Link
            href="/tools"
            className="inline-flex items-center gap-2 font-black text-[#F97316] transition hover:text-[#EA580C]"
          >
            View all tools
            <ArrowRight size={17} />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <section className="px-5 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[#E7E5E4] bg-[#111827] p-6 text-white shadow-[0_28px_90px_rgba(17,24,39,0.18)] sm:p-8 lg:p-10 dark:border-white/10 dark:bg-[#05070A]">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="font-black text-[#FDBA74]">Built around trust</p>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
                A calmer way to handle files online.
              </h2>
              <p className="mt-4 max-w-xl leading-8 text-white/65">
                FileGrip focuses on clean workflows, clear file handling, and a
                premium interface that helps users feel safe while working fast.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Privacy-first",
                  text: "Temporary processing and clear file expiry.",
                },
                {
                  icon: Zap,
                  title: "Productive",
                  text: "Simple tools that avoid unnecessary steps.",
                },
                {
                  icon: FileText,
                  title: "File-focused",
                  text: "Designed for PDF and document workflows.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5"
                >
                  <item.icon className="text-[#FDBA74]" size={28} />
                  <h3 className="mt-4 font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}