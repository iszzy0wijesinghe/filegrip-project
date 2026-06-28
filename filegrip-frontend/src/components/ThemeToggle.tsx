"use client";

/** @format */

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.setAttribute("data-theme", theme);
  localStorage.setItem("filegrip-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const currentTheme: Theme = root.classList.contains("dark")
      ? "dark"
      : "light";

    setTheme(currentTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
    setTheme(nextTheme);
  }

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E7E5E4] bg-white text-[#111827] shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
      >
        <Moon size={17} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E7E5E4] bg-white text-[#111827] shadow-sm transition hover:border-[#F97316] hover:text-[#F97316] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-[#F97316] dark:hover:text-[#FDBA74]"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}