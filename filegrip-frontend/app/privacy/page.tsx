/** @format */

import InlineFileGripLogo from "../../src/components/InlineFileGripLogo";
import Header from "../../src/components/Header";
import Footer from "../../src/components/Footer";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  EyeOff,
  FileLock2,
  Fingerprint,
  Globe2,
  KeyRound,
  LockKeyhole,
  Server,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";

export const metadata = {
  title: "Privacy & Security Policy | FileGrip",
  description:
    "Learn how FileGrip handles uploaded files, temporary processing, downloads, metadata, security, public demo access, and future Pro features.",
};

const trustCards = [
  {
    icon: Clock3,
    title: "Temporary processing",
    description:
      "Files are processed only for the selected workflow and kept for a limited download window.",
  },
  {
    icon: Trash2,
    title: "Automatic expiry",
    description:
      "Uploaded files, generated results, and download links are designed to expire after a short period.",
  },
  {
    icon: FileLock2,
    title: "Token downloads",
    description:
      "Processed files are served through temporary tokens instead of exposed public storage paths.",
  },
  {
    icon: EyeOff,
    title: "No public browsing",
    description:
      "Uploads and processed files are not intended to be visible through public directory listing.",
  },
];

const securityCards = [
  {
    icon: Fingerprint,
    title: "Generated filenames",
    description:
      "Files are stored with internal generated names instead of trusting original upload names.",
  },
  {
    icon: Server,
    title: "Server-side tools",
    description:
      "Processing runs on the server for consistent conversion, editing, protection, and cleanup.",
  },
  {
    icon: Database,
    title: "Limited metadata",
    description:
      "The platform may keep technical job metadata for reliability, debugging, and abuse prevention.",
  },
  {
    icon: ShieldEllipsis,
    title: "Abuse controls",
    description:
      "Upload limits, processing rules, expiry windows, and logs help reduce misuse.",
  },
];

const policySections = [
  {
    title: "What happens when you upload a file",
    body: (
      <>
        When you upload a file to <InlineFileGripLogo />, the file is used to
        complete the tool action you selected. This may include converting,
        compressing, merging, splitting, rotating, editing, protecting,
        unlocking, watermarking, signing, or redacting files. The processed
        output is then made available through a temporary download link.
      </>
    ),
  },
  {
    title: "Temporary storage and download window",
    body: (
      <>
        <InlineFileGripLogo /> is designed around temporary file handling. During
        the public demo, uploaded files and generated results are not intended to
        be stored permanently. Files may stay available for a short period so
        users can download their results before expiry.
      </>
    ),
  },
  {
    title: "Metadata we may keep",
    body: (
      <>
        To operate and protect the service, <InlineFileGripLogo /> may keep
        limited technical metadata, including tool name, job status, file size,
        output size, timestamps, download count, IP address, user agent, and
        processing error messages. This metadata helps with debugging, abuse
        prevention, usage limits, performance monitoring, and platform
        reliability.
      </>
    ),
  },
  {
    title: "File content access",
    body: (
      <>
        File content is processed automatically by the system to complete the
        selected task. File content should not be manually reviewed unless needed
        for abuse investigation, security review, legal compliance, or support
        requested by the user. Users should not upload files they do not own or
        do not have permission to process.
      </>
    ),
  },
  {
    title: "Security tools and passwords",
    body: (
      <>
        Security tools such as Protect PDF and Unlock PDF are provided for
        documents users own or are authorized to modify. Unlock PDF requires the
        correct existing password. <InlineFileGripLogo /> does not provide
        password cracking, bypassing, or unauthorized access tools.
      </>
    ),
  },
  {
    title: "Redaction responsibility",
    body: (
      <>
        Redact PDF is designed to apply permanent redaction to the processed
        output. Users are responsible for checking the final downloaded file
        before sharing it. For legal, medical, financial, government, or highly
        sensitive documents, users should independently verify the final result.
      </>
    ),
  },
  {
    title: "Public demo access",
    body: (
      <>
        <InlineFileGripLogo /> is currently available as a public demo. Current
        tools are included for up to 3 months while the platform is tested,
        improved, and prepared for production. Later, advanced and enhanced
        features may move into Pro plans.
      </>
    ),
  },
  {
    title: "Future Pro features",
    body: (
      <>
        Future Pro plans may include larger limits, batch workflows, saved
        history, priority processing, API access, enhanced security options, and
        advanced document tools. Any saved-history feature should be optional,
        user-controlled, and supported by clear deletion controls.
      </>
    ),
  },
  {
    title: "User responsibility",
    body: (
      <>
        Users are responsible for ensuring they have the right to upload,
        convert, edit, sign, protect, unlock, watermark, redact, download, and
        share their files. Users should verify processed files before relying on
        them for business, academic, legal, financial, or professional use.
      </>
    ),
  },
];

const quickPoints = [
  "Current tools included during public demo",
  "Temporary download links",
  "Generated internal filenames",
  "Future Pro features planned",
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FFF7ED] text-[#111827] dark:bg-[#080B10] dark:text-white">
      <Header />

      <section className="relative overflow-hidden px-4 py-10 sm:px-6 lg:py-14">
        <div className="pointer-events-none absolute left-[-12%] top-[-10%] h-72 w-72 rounded-full bg-[#F97316]/12 blur-3xl dark:bg-[#F97316]/18" />
        <div className="pointer-events-none absolute right-[-10%] top-[18%] h-80 w-80 rounded-full bg-[#FDBA74]/16 blur-3xl dark:bg-[#FDBA74]/10" />
        <div className="fg-soft-grid absolute inset-0 opacity-35 dark:opacity-20" />

        <div className="relative mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2.2rem] border border-[#FED7AA]/85 bg-white/82 shadow-[0_30px_100px_rgba(124,45,18,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
            <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="relative p-5 sm:p-8 lg:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#C2410C] shadow-sm dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
                  <ShieldCheck size={15} />
                  Privacy & security
                </div>

                <h1 className="mt-6 max-w-3xl text-[2rem] font-black leading-[1.06] tracking-tight text-[#111827] sm:text-5xl lg:text-[3.35rem] dark:text-white">
                  Clear file handling for a safer public demo.
                </h1>

                <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-[#57534E] sm:text-base sm:leading-8 dark:text-white/62">
                  This policy explains how our platform handles uploaded files,
                  processed outputs, temporary storage, technical metadata,
                  security tools, public demo access, and future Pro features.
                </p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {quickPoints.map((point) => (
                    <div
                      key={point}
                      className="flex items-center gap-2 rounded-2xl border border-[#FED7AA]/80 bg-[#FFF7ED]/80 px-3 py-2.5 text-xs font-black text-[#9A3412] dark:border-[#F97316]/20 dark:bg-[#F97316]/10 dark:text-[#FDBA74]/90"
                    >
                      <CheckCircle2 size={15} className="shrink-0" />
                      {point}
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.45rem] border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] to-white p-4 shadow-[0_18px_50px_rgba(249,115,22,0.08)] dark:border-[#F97316]/25 dark:from-[#F97316]/12 dark:to-white/[0.035]">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-[0_14px_30px_rgba(249,115,22,0.24)]">
                      <Globe2 size={20} />
                    </div>

                    <div>
                      <h2 className="text-sm font-black text-[#111827] dark:text-white">
                        Public demo terms
                      </h2>
                      <p className="mt-1.5 text-sm font-bold leading-7 text-[#9A3412] dark:text-[#FDBA74]/85">
                        All current tools are included for up to 3 months during
                        the public demo. Later, Pro plans may include larger
                        limits, saved history, batch processing, priority
                        processing, API access, and enhanced security options.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#FED7AA]/70 bg-[#FFF7ED]/60 p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-7 dark:border-white/10 dark:bg-white/[0.025]">
                <div className="grid gap-3 sm:grid-cols-2">
                  {trustCards.map((item) => (
                    <div
                      key={item.title}
                      className="group rounded-[1.45rem] border border-[#FED7AA]/75 bg-white/86 p-4 shadow-[0_16px_45px_rgba(124,45,18,0.07)] transition hover:-translate-y-1 hover:border-[#F97316]/45 hover:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none dark:hover:border-[#F97316]/45"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA]/70 transition group-hover:bg-[#F97316] group-hover:text-white dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                        <item.icon size={20} />
                      </div>

                      <h3 className="mt-4 text-sm font-black text-[#111827] dark:text-white">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-xs font-semibold leading-6 text-[#78716C] dark:text-white/58">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-[1.45rem] border border-[#FED7AA]/75 bg-[#111827] p-5 text-white shadow-[0_20px_55px_rgba(17,24,39,0.16)] dark:border-[#F97316]/25 dark:bg-[#0B0F14]">
                  <div className="flex items-start gap-3">
                    <Sparkles
                      className="mt-0.5 shrink-0 text-[#FDBA74]"
                      size={20}
                    />

                    <div>
                      <h3 className="text-sm font-black">
                        Built for confidence
                      </h3>
                      <p className="mt-2 text-xs font-semibold leading-6 text-white/62">
                        The public demo is designed to be simple to test while
                        keeping file expiry, controlled downloads, and user
                        responsibility clear.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {securityCards.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.5rem] border border-[#FED7AA]/75 bg-white/88 p-5 shadow-[0_18px_50px_rgba(124,45,18,0.07)] transition hover:-translate-y-1 hover:border-[#F97316]/45 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none dark:hover:border-[#F97316]/55"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA]/70 dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                  <item.icon size={21} />
                </div>

                <h3 className="mt-4 text-base font-black text-[#111827] dark:text-white">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm font-semibold leading-6 text-[#57534E] dark:text-white/60">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-[2rem] border border-[#FED7AA]/80 bg-white/90 p-4 shadow-[0_24px_70px_rgba(124,45,18,0.1)] backdrop-blur sm:p-6 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-[0_14px_32px_rgba(249,115,22,0.24)]">
                  <LockKeyhole size={22} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-[#111827] dark:text-white">
                    Detailed file handling policy
                  </h2>
                  <p className="mt-1 text-sm font-bold text-[#78716C] dark:text-white/55">
                    Clear rules for uploads, downloads, metadata, and security
                    tools.
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                {policySections.map((section, index) => (
                  <section
                    key={section.title}
                    className="rounded-[1.45rem] border border-[#E7E5E4] bg-[#FAFAF9] p-5 transition hover:border-[#FED7AA] hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-[#F97316]/35 dark:hover:bg-white/[0.055]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-xs font-black text-[#F97316] ring-1 ring-[#FED7AA] dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                        {index + 1}
                      </div>

                      <div>
                        <h3 className="text-base font-black text-[#111827] dark:text-white">
                          {section.title}
                        </h3>

                        <p className="mt-2 text-sm font-medium leading-7 text-[#57534E] sm:text-[15px] dark:text-white/62">
                          {section.body}
                        </p>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-[1.7rem] border border-[#FED7AA] bg-[#FFF7ED] p-5 shadow-[0_20px_55px_rgba(249,115,22,0.08)] dark:border-[#F97316]/25 dark:bg-[#F97316]/10">
                <div className="flex items-center gap-3">
                  <CalendarClock className="text-[#F97316]" size={22} />
                  <h3 className="font-black text-[#111827] dark:text-white">
                    Demo window
                  </h3>
                </div>

                <p className="mt-3 text-sm font-bold leading-7 text-[#9A3412] dark:text-[#FDBA74]/85">
                  Current tools are included for up to 3 months while the
                  platform is prepared for production and future Pro plans.
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-[#FED7AA] bg-white p-5 shadow-[0_20px_55px_rgba(124,45,18,0.07)] dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <Download className="text-[#F97316]" size={22} />
                  <h3 className="font-black text-[#111827] dark:text-white">
                    Temporary result links
                  </h3>
                </div>

                <p className="mt-3 text-sm font-semibold leading-7 text-[#57534E] dark:text-white/60">
                  Download links are temporary and should only work during the
                  configured job window.
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-[#FED7AA] bg-white p-5 shadow-[0_20px_55px_rgba(124,45,18,0.07)] dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <KeyRound className="text-[#F97316]" size={22} />
                  <h3 className="font-black text-[#111827] dark:text-white">
                    Password tools
                  </h3>
                </div>

                <p className="mt-3 text-sm font-semibold leading-7 text-[#57534E] dark:text-white/60">
                  Unlock tools require the correct existing password and
                  authorization to modify the document.
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-red-200 bg-red-50 p-5 shadow-[0_20px_55px_rgba(239,68,68,0.06)] dark:border-red-500/20 dark:bg-red-500/10">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className="text-red-600 dark:text-red-300"
                    size={22}
                  />
                  <h3 className="font-black text-red-800 dark:text-red-200">
                    Sensitive files
                  </h3>
                </div>

                <p className="mt-3 text-sm font-bold leading-7 text-red-700/85 dark:text-red-200/75">
                  Avoid uploading highly sensitive files unless temporary
                  server-side processing is acceptable for your use case.
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-[#E7E5E4] bg-white p-5 shadow-[0_20px_55px_rgba(124,45,18,0.07)] dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <UserCheck className="text-[#F97316]" size={22} />
                  <h3 className="font-black text-[#111827] dark:text-white">
                    Permission required
                  </h3>
                </div>

                <p className="mt-3 text-sm font-semibold leading-7 text-[#57534E] dark:text-white/60">
                  Only upload files you own or are authorized to process,
                  modify, protect, unlock, sign, watermark, redact, or share.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}