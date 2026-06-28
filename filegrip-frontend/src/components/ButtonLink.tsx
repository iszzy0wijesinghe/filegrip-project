import Link from "next/link";
import { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "orange" | "secondary" | "darkGhost";
  className?: string;
};

export default function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonLinkProps) {
  const styles = {
    primary:
      "bg-[#111827] text-white shadow-[0_14px_30px_rgba(17,24,39,0.18)] hover:bg-[#F97316] hover:text-white hover:shadow-[0_16px_35px_rgba(249,115,22,0.28)]",
    orange:
      "bg-[#F97316] text-white shadow-[0_14px_30px_rgba(249,115,22,0.25)] hover:bg-[#EA580C] hover:text-white",
    secondary:
      "border border-[#E7E5E4] bg-white text-[#111827] hover:border-[#F97316] hover:bg-[#FFF7ED] hover:text-[#F97316]",
    darkGhost:
      "border border-white/10 bg-white/[0.03] text-white/75 hover:border-[#F97316] hover:bg-[#F97316]/10 hover:text-[#FDBA74]",
  };

  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}