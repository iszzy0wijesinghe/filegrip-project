/** @format */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export type ToolCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  tools: Tool[];
};

export type Tool = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  input_types: string[] | null;
  output_types: string[] | null;
  is_active: boolean;
  is_premium: boolean;
  requires_login: boolean;
  max_file_size_mb: number | null;
  max_files_per_job: number | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  category?: ToolCategory;
};

export type Plan = {
  id: number;
  name: string;
  slug: string;
  price_monthly: string | number;
  price_yearly: string | number;
  currency: string;
  max_file_size_mb: number;
  daily_job_limit: number;
  monthly_job_limit: number;
  max_files_per_job: number;
  max_batch_jobs: number;
  storage_days: number;
  priority_level: number;
  can_store_files: boolean;
  can_use_batch: boolean;
  can_use_api: boolean;
  has_ads: boolean;
  is_active: boolean;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }

  const json = await res.json();

  return json?.data ?? json;
}

export async function getToolCategories(): Promise<ToolCategory[]> {
  const data = await fetchJson<ToolCategory[] | { data: ToolCategory[] }>(
    `${API_URL}/tool-categories`,
  );

  return Array.isArray(data) ? data : data.data ?? [];
}

export async function getTools(): Promise<Tool[]> {
  const data = await fetchJson<Tool[] | { data: Tool[] }>(`${API_URL}/tools`);

  return Array.isArray(data) ? data : data.data ?? [];
}

export async function getTool(slug: string): Promise<Tool | null> {
  try {
    const data = await fetchJson<Tool | { data: Tool }>(
      `${API_URL}/tools/${slug}`,
    );

    return "data" in data ? data.data : data;
  } catch {
    return null;
  }
}

export async function getPlans(): Promise<Plan[]> {
  const data = await fetchJson<Plan[] | { data: Plan[] }>(`${API_URL}/plans`);

  return Array.isArray(data) ? data : data.data ?? [];
}