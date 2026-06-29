/** @format */

import Link from "next/link";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { label: "Tools", href: "/tools", disabled: false },
  { label: "Pricing", href: "/pricing", disabled: true },
  { label: "Privacy", href: "/privacy", disabled: false },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#FED7AA]/70 bg-[#FFFBF7]/88 backdrop-blur-2xl dark:border-white/10 dark:bg-[#080B10]/88">
      <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <BrandLogo variant="auto" size="sm" />

        <nav className="hidden items-center rounded-full border border-[#FED7AA]/80 bg-white/90 p-1.5 shadow-[0_10px_30px_rgba(17,24,39,0.07)] md:flex dark:border-white/10 dark:bg-white/[0.04]">
          {navItems.map((item) => {
            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  aria-disabled="true"
                  title="Pricing coming soon"
                  className="group relative cursor-not-allowed rounded-full px-4 py-2 text-sm font-extrabold text-[#A8A29E] dark:text-white/35"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F97316] ring-1 ring-[#FED7AA] dark:bg-[#F97316]/10 dark:ring-[#F97316]/25">
                      Soon
                    </span>
                  </span>

                  <span className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-[#FED7AA] bg-white px-3 py-1.5 text-[11px] font-black text-[#9A3412] shadow-[0_14px_35px_rgba(17,24,39,0.14)] group-hover:block dark:border-[#F97316]/25 dark:bg-[#111827] dark:text-[#FDBA74]">
                    Pricing coming soon
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-extrabold text-[#57534E] transition hover:bg-[#FFF7ED] hover:text-[#F97316] dark:text-white/70 dark:hover:bg-[#F97316]/10 dark:hover:text-[#FDBA74]"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Link
            href="/tools"
            className="inline-flex items-center justify-center rounded-full bg-[#F97316] px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(249,115,22,0.24)] transition hover:-translate-y-0.5 hover:bg-[#EA580C] sm:px-5"
          >
            Start demo
          </Link>
        </div>
      </div>
    </header>
  );
}