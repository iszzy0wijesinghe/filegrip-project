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
import WordToPdfUpload from "./tool-uploads/WordToPdfUpload";
import PdfToWordUpload from "./tool-uploads/PdfToWordUpload";
import CompressImageUpload from "./tool-uploads/CompressImageUpload";
import ResizeImageUpload from "./tool-uploads/ResizeImageUpload";
import ConvertImageUpload from "./tool-uploads/ConvertImageUpload";
import CropImageUpload from "./tool-uploads/CropImageUpload";
import RotateImageUpload from "./tool-uploads/RotateImageUpload";
import ProtectPdfUpload from "./tool-uploads/ProtectPdfUpload";
import UnlockPdfUpload from "./tool-uploads/UnlockPdfUpload";
import AddWatermarkUpload from "./tool-uploads/AddWatermarkUpload";
import SignPdfUpload from "./tool-uploads/SignPdfUpload";
import RedactPdfUpload from "./tool-uploads/RedactPdfUpload";


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
    toolSlug === "webp-to-pdf" ||
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

  if (toolSlug === "word-to-pdf") {
  return (
    <WordToPdfUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

if (toolSlug === "pdf-to-word") {
  return (
    <PdfToWordUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

  if (toolSlug === "compress-image") {

    return (

      <CompressImageUpload

        toolSlug={toolSlug}

        inputTypes={inputTypes}

        maxFileSizeMb={maxFileSizeMb}

      />

    );

  }

  if (toolSlug === "resize-image") {

    return (

      <ResizeImageUpload

        toolSlug={toolSlug}

        inputTypes={inputTypes}

        maxFileSizeMb={maxFileSizeMb}

      />

    );

  }

  if (toolSlug === "convert-image") {

    return (

      <ConvertImageUpload

        toolSlug={toolSlug}

        inputTypes={inputTypes}

        maxFileSizeMb={maxFileSizeMb}

      />

    );

  }

  if (toolSlug === "crop-image") {

    return (

      <CropImageUpload

        toolSlug={toolSlug}

        inputTypes={inputTypes}

        maxFileSizeMb={maxFileSizeMb}

      />

    );

  }

  if (toolSlug === "rotate-image") {

    return (

      <RotateImageUpload

        toolSlug={toolSlug}

        inputTypes={inputTypes}

        maxFileSizeMb={maxFileSizeMb}

      />

    );

  }


  if (toolSlug === "protect-pdf") {
  return (
    <ProtectPdfUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

if (toolSlug === "unlock-pdf") {
  return (
    <UnlockPdfUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

if (toolSlug === "add-watermark") {
  return (
    <AddWatermarkUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

if (toolSlug === "sign-pdf") {
  return (
    <SignPdfUpload
      toolSlug={toolSlug}
      inputTypes={inputTypes}
      maxFileSizeMb={maxFileSizeMb}
    />
  );
}

if (toolSlug === "redact-pdf") {
  return (
    <RedactPdfUpload
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
