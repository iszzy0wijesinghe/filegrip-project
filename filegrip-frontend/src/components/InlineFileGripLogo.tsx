"use client";

/** @format */

import Image from "next/image";
import { useEffect, useState } from "react";

export default function InlineFileGripLogo() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <span className="mx-1 inline-flex translate-y-[1px] items-center align-baseline">
      <Image
        src={
          isDark
            ? "/images/filegrip-logo-white.webp"
            : "/images/filegrip-logo.webp"
        }
        alt="FileGrip"
        width={90}
        height={20}
        className="h-auto w-[48px] sm:w-[52px]"
        priority={false}
      />
    </span>
  );
}