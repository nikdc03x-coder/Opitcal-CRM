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
