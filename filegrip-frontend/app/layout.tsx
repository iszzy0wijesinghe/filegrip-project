import type { Metadata } from "next";
import AppStartLoader from "../src/components/AppStartLoader";
import "./globals.css";

export const metadata: Metadata = {
  title: "FileGrip — Files, Firmly Handled.",
  description:
    "Fast, private PDF and file tools for converting, compressing, editing, and protecting documents online.",
};

const themeScript = `
(function () {
  try {
    var savedTheme = localStorage.getItem("filegrip-theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      return;
    }

    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      return;
    }

    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("filegrip-theme", "light");
  } catch (e) {
    document.documentElement.classList.remove("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full overflow-hidden bg-[#FFF7ED] dark:bg-[#080B10]"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body className="h-full overflow-hidden bg-[#FFF7ED] text-[#111827] antialiased dark:bg-[#080B10] dark:text-white">
        <AppStartLoader />

        <div className="filegrip-scroll-root">{children}</div>
      </body>
    </html>
  );
}