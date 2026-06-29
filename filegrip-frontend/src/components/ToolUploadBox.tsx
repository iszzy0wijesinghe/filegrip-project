/** @format */

"use client";

/** @format */

import MergePdfUpload from "./tool-uploads/MergePdfUpload";
import SingleFileUpload from "./tool-uploads/SingleFileUpload";
import ImageToPdfUpload from "./tool-uploads/ImageToPdfUpload";
import SplitPdfUpload from "./tool-uploads/SplitPdfUpload";
import RotatePdfUpload from "./tool-uploads/RotatePdfUpload";
import DeletePdfPagesUpload from "./tool-uploads/DeletePdfPagesUpload";
import ReorderPdfPagesUpload from "./tool-uploads/ReorderPdfPagesUpload";
import PdfToImageUpload from "./tool-uploads/PdfToImageUpload";

type ToolUploadBoxProps = {
  toolSlug: string;
  inputTypes: string[];
  maxFileSizeMb?: number | null;
};

export default function ToolUploadBox({
  toolSlug,
  inputTypes,
  maxFileSizeMb = 25,
}: ToolUploadBoxProps) {
  if (toolSlug === "merge-pdf") {
    return (
      <MergePdfUpload
        toolSlug={toolSlug}
        inputTypes={inputTypes}
        maxFileSizeMb={maxFileSizeMb}
      />
    );
  }

  if (
    toolSlug === "jpg-to-pdf" ||
    toolSlug === "png-to-pdf" ||
    toolSlug === "image-to-pdf"
  ) {
    return (
      <ImageToPdfUpload
        toolSlug={toolSlug}
        inputTypes={inputTypes}
        maxFileSizeMb={maxFileSizeMb}
      />
    );
  }

  if (toolSlug === "split-pdf") {
    return (
      <SplitPdfUpload
        toolSlug={toolSlug}
        inputTypes={inputTypes}
        maxFileSizeMb={maxFileSizeMb}
      />
    );
  }

  if (toolSlug === "rotate-pdf") {
    return (
      <RotatePdfUpload
        toolSlug={toolSlug}
        inputTypes={inputTypes}
        maxFileSizeMb={maxFileSizeMb}
      />
    );
  }

  if (toolSlug === "delete-pdf-pages") {
    return (
      <DeletePdfPagesUpload
        toolSlug={toolSlug}
        inputTypes={inputTypes}
        maxFileSizeMb={maxFileSizeMb}
      />
    );
  }

  if (toolSlug === "reorder-pdf-pages") {
    return (
      <ReorderPdfPagesUpload
        toolSlug={toolSlug}
        inputTypes={inputTypes}
        maxFileSizeMb={maxFileSizeMb}
      />
    );
  }

  if (
  toolSlug === "pdf-to-image" ||
  toolSlug === "pdf-to-jpg" ||
  toolSlug === "pdf-to-png" ||
  toolSlug === "pdf-to-webp"
) {
  return (
    <PdfToImageUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

  return (
    <SingleFileUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}
