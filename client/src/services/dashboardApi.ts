
// nik - Shared types for the interactive analytics dashboard.

export type AnalyticsYear = {
  year: number;
  purchases: number;
  value: number;
  months: {
    month: number;
    purchases: number;
    value: number;
  }[];
  categories: {
    name: string;
    value: number;
  }[];
};

export type DashboardAnalyticsData = {
  currentYear: number;
  totalCustomers: number;
  years: AnalyticsYear[];
  recent: {
    id: string;
    customerId: string;
    customerName: string;
    frame: string | null;
    lens: string | null;
    value: number;
    purchaseDate: string | null;
  }[];
};

// nik - Fetch the full three-year dataset only once.
export async function getDashboardAnalytics(
  signal?: AbortSignal
): Promise<DashboardAnalyticsData> {
  const response = await fetch("/api/dashboard", {
    credentials: "include",
    signal,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message ||
        `Unable to load analytics (HTTP ${response.status}).`
    );
  }

  return result.data as DashboardAnalyticsData;
}
