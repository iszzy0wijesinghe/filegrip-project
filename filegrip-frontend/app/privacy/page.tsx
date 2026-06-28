import Header from "../../src/components/Header";
import Footer from "../../src/components/Footer";
import { Clock3, Database, ShieldCheck, Trash2 } from "lucide-react";

export const metadata = {
  title: "Privacy | FileGrip",
  description:
    "FileGrip is designed with temporary processing and privacy-first file handling.",
};

const privacyItems = [
  {
    icon: Clock3,
    title: "Temporary processing",
    description:
      "FileGrip is designed to process files temporarily. For free users, files should not be permanently stored unless a future premium feature allows the user to choose file history.",
  },
  {
    icon: Trash2,
    title: "Automatic deletion",
    description:
      "Uploaded and processed files should be automatically deleted after a short expiry period. The platform may keep basic metadata such as tool name, job status, file size, and timestamps for security and usage limits.",
  },
  {
    icon: Database,
    title: "Premium history later",
    description:
      "Premium users may later receive optional saved document history. This should be controlled by the user and supported by clear deletion controls.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF9] text-[#111827] dark:bg-[#080B10] dark:text-white">
      <Header />

      <section className="relative overflow-hidden px-5 py-14 sm:px-6 lg:py-20">
        <div className="fg-ambient right-[8%] top-8 opacity-70" />
        <div className="fg-soft-grid absolute inset-0 opacity-40 dark:opacity-25" />

        <div className="relative mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C2410C] dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
              <ShieldCheck size={16} />
              Privacy-first
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl dark:text-white">
              Your files are handled, not hoarded.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-[#78716C] sm:text-lg dark:text-white/60">
              FileGrip is built around trust, temporary processing, and clear
              file handling. Your workflow should feel fast, safe, and calm.
            </p>
          </div>

          <div className="mt-10 rounded-[2rem] border border-[#E7E5E4] bg-white/90 p-4 shadow-[0_24px_70px_rgba(17,24,39,0.08)] backdrop-blur sm:p-6 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div className="grid gap-4">
              {privacyItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-[#E7E5E4] bg-[#FAFAF9] p-6 transition hover:border-[#FDBA74] hover:bg-[#FFF7ED] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-[#F97316]/60 dark:hover:bg-[#F97316]/10"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA]/70 dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                      <item.icon size={24} />
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-[#111827] dark:text-white">
                        {item.title}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-[#57534E] sm:text-base dark:text-white/60">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[#FED7AA] bg-[#FFF7ED] p-5 text-sm leading-7 text-[#9A3412] dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
              FileGrip should always protect customer confidence: clear expiry,
              safe downloads, and no confusing file storage behavior.
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}