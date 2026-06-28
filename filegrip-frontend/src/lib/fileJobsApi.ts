/** @format */

import { API_URL } from "./api";

export type FileJobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "deleted";

export type FileJobResponse = {
  uuid: string;
  status: FileJobStatus;
  tool_slug: string;
  message?: string;
  download_url?: string | null;
  error_message?: string | null;
};

export async function createFileJob({
  toolSlug,
  files,
  settings = {},
}: {
  toolSlug: string;
  files: File[];
  settings?: Record<string, unknown>;
}): Promise<FileJobResponse> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files[]", file);
  });

  formData.append("settings", JSON.stringify(settings));

  const response = await fetch(`${API_URL}/tools/${toolSlug}/process`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error_message || "File processing failed.",
    );
  }

  return data;
}

export async function getFileJob(uuid: string): Promise<FileJobResponse> {
  const response = await fetch(`${API_URL}/file-jobs/${uuid}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Could not load file job.");
  }

  return data;
}