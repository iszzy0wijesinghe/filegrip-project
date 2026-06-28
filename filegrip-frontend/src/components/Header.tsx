/** @format */

import Link from "next/link";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { label: "Tools", href: "/tools" },
  { label: "Pricing", href: "/pricing" },
  { label: "Privacy", href: "/privacy" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E7E5E4]/80 bg-[#FAFAF9]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#080B10]/88">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <BrandLogo variant="auto" size="sm" />

        <nav className="hidden items-center rounded-full border border-[#E7E5E4] bg-white/95 p-1.5 shadow-[0_10px_30px_rgba(17,24,39,0.08)] md:flex dark:border-white/10 dark:bg-white/[0.04]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-extrabold text-[#57534E] transition hover:bg-[#FFF7ED] hover:text-[#F97316] dark:text-white/70 dark:hover:bg-[#F97316]/10 dark:hover:text-[#FDBA74]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Link
            href="/tools"
            className="inline-flex items-center justify-center rounded-full bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_30px_rgba(17,24,39,0.18)] transition hover:-translate-y-0.5 hover:bg-[#F97316] sm:px-5 dark:bg-[#F97316] dark:hover:bg-[#FB923C]"
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}