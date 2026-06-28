"use client";

/** @format */

import { useEffect, useState } from "react";
import FileGripLoader from "./FileGripLoader";

export default function AppStartLoader() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("filegrip-start-loader");

    if (alreadyShown) {
      setShow(false);
      return;
    }

    sessionStorage.setItem("filegrip-start-loader", "shown");

    const timer = window.setTimeout(() => {
      setShow(false);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <FileGripLoader
        fullScreen
        minTimeMs={2400}
        label="Starting FileGrip..."
      />
    </div>
  );
}