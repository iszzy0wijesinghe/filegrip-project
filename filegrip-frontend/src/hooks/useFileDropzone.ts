"use client";

/** @format */

import { DragEvent, useCallback, useState } from "react";

type UseFileDropzoneOptions = {
  disabled?: boolean;
  multiple?: boolean;
  onFilesDrop: (files: File[]) => void;
};

export default function useFileDropzone({
  disabled = false,
  multiple = false,
  onFilesDrop,
}: UseFileDropzoneOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const hasFiles = (event: DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer.types).includes("Files");
  };

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || !hasFiles(event)) return;

      event.preventDefault();
      event.stopPropagation();

      setIsDragging(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || !hasFiles(event)) return;

      event.preventDefault();
      event.stopPropagation();

      event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;

      event.preventDefault();
      event.stopPropagation();

      const currentTarget = event.currentTarget;
      const relatedTarget = event.relatedTarget as Node | null;

      if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
        setIsDragging(false);
      }
    },
    [disabled],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled) return;

      event.preventDefault();
      event.stopPropagation();

      setIsDragging(false);

      const droppedFiles = Array.from(event.dataTransfer.files || []);

      if (droppedFiles.length < 1) return;

      onFilesDrop(multiple ? droppedFiles : droppedFiles.slice(0, 1));
    },
    [disabled, multiple, onFilesDrop],
  );

  return {
    isDragging,
    dropzoneHandlers: {
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}