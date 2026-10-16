
// nik - Keep dashboard API requests separate from customer APIs.

export type DashboardAnalyticsData = {
  summary: {
    totalCustomers: number;
    totalPurchases: number;
    totalPurchaseValue: number;
    last30DaysPurchases: number;
  };
  monthly: {
    month: string;
    purchases: number;
    value: number;
  }[];
  recent: {
    id: string;
    customerId: string;
    customerName: string;
    frame: string | null;
    lens: string | null;
    value: number;
    purchaseDate: string | null;
    createdAt: string;
  }[];
};

export async function getDashboardAnalytics(
  signal?: AbortSignal
): Promise<DashboardAnalyticsData> {
  // nik - Use the existing Vite proxy and Admin cookie.
  const response = await fetch("/api/dashboard", {
    credentials: "include",
    signal,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message || `Dashboard request failed (${response.status}).`
    );
  }

  return result.data as DashboardAnalyticsData;
}
