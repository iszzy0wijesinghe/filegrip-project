"use client";

/** @format */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type BrandLogoProps = {
  variant?: "auto" | "dark" | "light";
  size?: "xs" | "sm" | "md" | "lg";
  href?: string;
  className?: string;
};

type Theme = "light" | "dark";

const sizes = {
  xs: "w-[72px] sm:w-[82px]",
  sm: "w-[105px] sm:w-[118px] lg:w-[128px]",
  md: "w-[125px] sm:w-[140px] lg:w-[150px]",
  lg: "w-[150px] sm:w-[170px] lg:w-[185px]",
};

export default function BrandLogo({
  variant = "auto",
  size = "sm",
  href = "/",
  className = "",
}: BrandLogoProps) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    function readTheme() {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    }

    readTheme();

    const observer = new MutationObserver(readTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const shouldUseLightLogo =
    variant === "light" || (variant === "auto" && theme === "dark");

  const src = shouldUseLightLogo
    ? "/images/filegrip-logo-white.webp"
    : "/images/filegrip-logo.webp";

  const logo = (
    <Image
      src={src}
      alt="FileGrip"
      width={900}
      height={220}
      priority={size === "sm" || size === "md"}
      className={`block h-auto ${sizes[size]} ${className}`}
    />
  );

  if (!href) return logo;

  return (
    <Link href={href} className="inline-flex items-center">
      {logo}
    </Link>
  );
}