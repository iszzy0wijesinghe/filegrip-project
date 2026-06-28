import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import Header from "../../../src/components/Header";
import Footer from "../../../src/components/Footer";
import ToolUploadBox from "../../../src/components/ToolUploadBox";
import { getTool } from "../../../src/lib/api";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const tool = await getTool(slug);

  if (!tool) {
    return {
      title: "Tool Not Found | FileGrip",
    };
  }

  return {
    title: tool.seo_title ?? `${tool.name} | FileGrip`,
    description: tool.seo_description ?? tool.short_description ?? "",
  };
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = await getTool(slug);

  if (!tool) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-[#111827] dark:bg-[#080B10] dark:text-white">
      <Header />

      <section className="relative overflow-hidden px-5 py-8 sm:px-6 lg:py-10">
        <div className="fg-ambient left-[10%] top-8 opacity-50" />
        <div className="fg-soft-grid absolute inset-0 opacity-35 dark:opacity-20" />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 text-sm font-black text-[#78716C] transition hover:text-[#F97316] dark:text-white/55 dark:hover:text-[#FDBA74]"
          >
            <ArrowLeft size={16} />
            Back to all tools
          </Link>

          <div className="mt-8 rounded-[2rem] border border-[#E7E5E4] bg-white/65 p-6 shadow-[0_24px_70px_rgba(17,24,39,0.06)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C2410C] dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
                  {tool.category?.name ?? "FileGrip Tool"}
                </div>

                <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl dark:text-white">
                  {tool.name}
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-8 text-[#78716C] sm:text-lg dark:text-white/60">
                  {tool.description}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:self-end">
                {["Fast processing", "Private by default", "Auto-delete files"].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-2xl border border-[#E7E5E4] bg-white px-4 py-3 text-sm font-black text-[#57534E] shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                    >
                      <CheckCircle2
                        className="shrink-0 text-[#22C55E]"
                        size={18}
                      />
                      <span>{item}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <ToolUploadBox
              toolSlug={tool.slug}
              inputTypes={tool.input_types ?? []}
              maxFileSizeMb={tool.max_file_size_mb ?? 25}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Upload,
              title: "1. Upload",
              description:
                "Choose your files from your device and arrange them in the order you want.",
            },
            {
              icon: Zap,
              title: "2. Process",
              description:
                "FileGrip processes your files quickly using a secure tool workflow.",
            },
            {
              icon: Download,
              title: "3. Download",
              description:
                "Download your processed file. Temporary files are deleted after expiry.",
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-[1.75rem] border border-[#E7E5E4] bg-white p-6 transition hover:-translate-y-1 hover:border-[#FDBA74] hover:shadow-[0_22px_50px_rgba(249,115,22,0.12)] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-[#F97316]/60"
            >
              <step.icon className="text-[#F97316]" size={30} />
              <h3 className="mt-4 text-xl font-black text-[#111827] dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 leading-7 text-[#78716C] dark:text-white/55">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#111827] px-5 py-16 text-white sm:px-6 dark:bg-[#05070A]">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
          <div>
            <p className="font-black text-[#FDBA74]">Privacy-first</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              Your file is handled with care.
            </h2>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
            <ShieldCheck className="text-[#FDBA74]" size={32} />
            <h3 className="mt-4 text-xl font-black">Temporary processing</h3>
            <p className="mt-3 leading-7 text-white/65">
              Free files are processed temporarily and are not saved permanently.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
            <FileText className="text-[#FDBA74]" size={32} />
            <h3 className="mt-4 text-xl font-black">Built for productivity</h3>
            <p className="mt-3 leading-7 text-white/65">
              Every FileGrip tool is designed to be simple, fast, and smooth.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}