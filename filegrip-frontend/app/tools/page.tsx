import Header from "../../src/components/Header";
import Footer from "../../src/components/Footer";
import ToolCard from "../../src/components/ToolCard";
import { getToolCategories } from "../../src/lib/api";
import { Layers3 } from "lucide-react";

export const metadata = {
  title: "All Tools | FileGrip",
  description:
    "Browse FileGrip PDF, document, image, conversion, and security tools.",
};

export default async function ToolsPage() {
  const categories = await getToolCategories();

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-[#111827] dark:bg-[#080B10] dark:text-white">
      <Header />

      <section className="relative overflow-hidden px-5 py-14 sm:px-6 lg:py-20">
        <div className="fg-ambient right-[10%] top-10 opacity-70" />
        <div className="fg-soft-grid absolute inset-0 opacity-40 dark:opacity-25" />

        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C2410C] dark:border-[#F97316]/25 dark:bg-[#F97316]/10 dark:text-[#FDBA74]">
              <Layers3 size={16} />
              FileGrip tools
            </div>

            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl dark:text-white">
              Choose the right tool for your file.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-[#78716C] sm:text-lg dark:text-white/60">
              Convert, compress, edit, merge, split, and protect your files with
              fast, private online tools.
            </p>
          </div>

          <div className="mt-14 space-y-14">
            {categories.map((category) => (
              <section key={category.id}>
                <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-2xl font-black text-[#111827] sm:text-3xl dark:text-white">
                      {category.name}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78716C] sm:text-base dark:text-white/55">
                      {category.description}
                    </p>
                  </div>

                  <div className="hidden h-px flex-1 bg-gradient-to-r from-[#E7E5E4] to-transparent sm:block dark:from-white/10" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {category.tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}