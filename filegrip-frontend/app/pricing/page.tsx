import Header from "../../src/components/Header";
import Footer from "../../src/components/Footer";
import { CheckCircle2, Crown, Sparkles, Zap } from "lucide-react";
import { getPlans } from "../../src/lib/api";

export const metadata = {
  title: "Pricing | FileGrip",
  description: "Choose a FileGrip plan for your file workflow.",
};

export default async function PricingPage() {
  const plans = await getPlans();

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-[#111827] dark:bg-[#080B10] dark:text-white">
      <Header />

      <section className="relative overflow-hidden px-5 py-14 sm:px-6 lg:py-20">
        <div className="fg-ambient left-[15%] top-8 opacity-70" />
        <div className="fg-soft-grid absolute inset-0 opacity-40 dark:opacity-25" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C2410C] dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
              <Sparkles size={16} />
              Pricing
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl dark:text-white">
              Simple plans for every workflow.
            </h1>

            <p className="mt-5 text-base leading-8 text-[#78716C] sm:text-lg dark:text-white/60">
              Start free and upgrade when you need larger files, batch tools,
              priority processing, and premium features.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {plans.map((plan, index) => {
              const isPopular =
                plan.slug === "pro" ||
                plan.name.toLowerCase().includes("pro") ||
                index === 1;

              return (
                <div
                  key={plan.id}
                  className={`relative overflow-hidden rounded-[2rem] border bg-white p-6 transition duration-300 hover:-translate-y-1 sm:p-7 dark:bg-white/[0.04] ${
                    isPopular
                      ? "border-[#FDBA74] shadow-[0_28px_80px_rgba(249,115,22,0.16)] dark:border-[#F97316]/70"
                      : "border-[#E7E5E4] shadow-sm hover:border-[#FDBA74] dark:border-white/10 dark:hover:border-[#F97316]/60"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-[#F97316] px-3 py-1 text-xs font-black text-white">
                      <Crown size={13} />
                      Popular
                    </div>
                  )}

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA]/70 dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                    <Zap size={23} />
                  </div>

                  <h2 className="mt-5 text-2xl font-black text-[#111827] dark:text-white">
                    {plan.name}
                  </h2>

                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-5xl font-black text-[#111827] dark:text-white">
                      ${Number(plan.price_monthly).toFixed(0)}
                    </span>
                    <span className="mb-2 text-sm font-bold text-[#78716C] dark:text-white/50">
                      /month
                    </span>
                  </div>

                  <div className="mt-7 space-y-3 text-sm text-[#57534E] dark:text-white/60">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={17} className="text-[#22C55E]" />
                      Max file size: {plan.max_file_size_mb} MB
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={17} className="text-[#22C55E]" />
                      Daily jobs: {plan.daily_job_limit}
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={17} className="text-[#22C55E]" />
                      Monthly jobs: {plan.monthly_job_limit}
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={17} className="text-[#22C55E]" />
                      Batch processing: {plan.can_use_batch ? "Yes" : "No"}
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle2 size={17} className="text-[#22C55E]" />
                      Ads: {plan.has_ads ? "Yes" : "No"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`mt-8 w-full rounded-full px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 ${
                      isPopular
                        ? "bg-[#F97316] text-white hover:bg-[#EA580C]"
                        : "bg-[#111827] text-white hover:bg-[#F97316] dark:bg-white dark:text-[#111827] dark:hover:bg-[#F97316] dark:hover:text-white"
                    }`}
                  >
                    Choose {plan.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}