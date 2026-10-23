import { apiFetch } from "./http";
export function analyticsUrl(
  report: string,
  values: Record<string, string | number | undefined> = {},
) {
  const params = new URLSearchParams();
  Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
  return `/api/analytics/${report}${params.size ? `?${params}` : ""}`;
}
export async function getAnalytics<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(url, { signal });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw new Error(result?.message || `Unable to load report (${response.status}). Please retry.`);
  return result.data as T;
}
export async function downloadAnalyticsCsv(
  values: Record<string, string | number | undefined>,
  signal?: AbortSignal,
) {
  const response = await apiFetch(analyticsUrl("purchases.csv", values), { signal });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Unable to export purchases.");
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "optilens-purchases.csv";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
