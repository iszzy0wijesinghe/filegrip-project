/** @format */

import Link from "next/link";
import BrandLogo from "./BrandLogo";

const footerLinks = [
  { label: "Tools", href: "/tools" },
  { label: "Pricing", href: "/pricing" },
  { label: "Privacy", href: "/privacy" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0B0F14] text-white">
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandLogo variant="light" size="sm" />

            <p className="mt-2 max-w-md text-sm leading-5 text-white/55">
              Files, Firmly Handled. Fast, private PDF and file tools by
              Motiora.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 md:justify-end">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-sm font-bold text-white/70 transition hover:border-[#F97316] hover:bg-[#F97316]/10 hover:text-[#FDBA74]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-1.5 pt-3 text-xs font-medium text-white/40 md:flex-row md:items-center md:justify-between">
          <p>© 2026 FileGrip by Motiora Software Solutions.</p>
          <p>Fast. Private. Firmly handled.</p>
        </div>
      </div>
    </footer>
  );
}