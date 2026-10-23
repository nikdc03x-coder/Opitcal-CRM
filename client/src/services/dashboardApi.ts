import type { DashboardAnalyticsData } from "../models/dashboard";

import { apiFetch } from "./http";

// Fetch the full three-year dataset only once.
export async function getDashboardAnalytics(signal?: AbortSignal): Promise<DashboardAnalyticsData> {
  const response = await apiFetch("/api/dashboard", {
    signal,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Unable to load analytics (HTTP ${response.status}).`);
  }

  return result.data as DashboardAnalyticsData;
}
