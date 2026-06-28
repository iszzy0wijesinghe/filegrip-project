"use client";

/** @format */

import { useEffect, useState } from "react";
import FileGripLoader from "./FileGripLoader";

type RouteLoadingScreenProps = {
  minTimeMs?: number;
};

export default function RouteLoadingScreen({
  minTimeMs = 2200,
}: RouteLoadingScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShow(false);
    }, minTimeMs);

    return () => window.clearTimeout(timer);
  }, [minTimeMs]);

  if (!show) {
    return null;
  }

  return (
    <FileGripLoader
      fullScreen
      minTimeMs={minTimeMs}
      label="Preparing FileGrip..."
    />
  );
}