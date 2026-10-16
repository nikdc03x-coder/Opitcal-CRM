// nik - Keep one type-only contract for analytics API responses and the React reporting views.
export type AnalyticsPeriod = { from: string | null; to: string | null; label: string };
export type PurchaseMix = "Frame Only" | "Lens Only" | "Frame + Lens" | "Unclassified";
export type AnalyticsSummary = {
  purchases: number;
  value: string;
  customers: number;
  average: string;
  highest: string;
  frames: number;
  lenses: number;
  frameOnly: number;
  lensOnly: number;
  both: number;
  unclassified: number;
  undated: number;
};
export type AnalyticsPoint = {
  label: string;
  value: string;
  purchases: number;
  customers: number;
  from: string;
  to: string;
};
export type AnalyticsRank = {
  name: string;
  purchases: number;
  share: number;
  frame?: string;
  lens?: string;
};
export type AnalyticsDistribution = { name: string; count: number; share: number };
export type AnalyticsReport = {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary;
  calculatedAt: string;
};
export type AnalyticsChange = {
  value: string;
  percent: number | null;
  purchases: number;
  average: string;
};
export type AnalyticsOverview = AnalyticsReport & {
  activeCustomers: number;
  trend: AnalyticsPoint[];
  mix: AnalyticsRank[];
  frames: AnalyticsRank[];
  lenses: AnalyticsRank[];
  previous: { period: AnalyticsPeriod; summary: AnalyticsSummary; change: AnalyticsChange } | null;
};
export type AnalyticsPurchase = {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string | null;
  purchaseDate: string | null;
  frame: string | null;
  lens: string | null;
  pricingMode: "SPLIT" | "MRP_ONLY";
  frameRate: string | null;
  lensRate: string | null;
  mrp: string;
};
export type AnalyticsPurchases = AnalyticsReport & {
  rows: AnalyticsPurchase[];
  page: number;
  pageSize: number;
  total: number;
};
export type AnalyticsComparison = AnalyticsReport & {
  comparison: { period: AnalyticsPeriod; summary: AnalyticsSummary };
  change: AnalyticsChange;
};
export type AnalyticsProducts = AnalyticsReport & {
  kind: "frames" | "lenses";
  containing: number;
  splitValue: string;
  totalOnly: number;
  trend: AnalyticsPoint[];
  rankings: Record<string, AnalyticsRank[]>;
  options: Record<string, string[]>;
  visionCounts: Record<string, number>;
};
export type AnalyticsCustomers = AnalyticsReport & {
  registered: number;
  active: number;
  newRegistrations: number;
  repeat: number;
  gender: {
    registered: AnalyticsDistribution[];
    purchasing: AnalyticsDistribution[];
    purchases: AnalyticsDistribution[];
  };
  ages: AnalyticsDistribution[];
  missingAge: number;
  ageCoverage: number;
  frequency: AnalyticsDistribution[];
  registrations: { label: string; count: number }[];
  activity: { label: string; customers: number; repeat: number; purchases: number }[];
};
export type AnalyticsMix = AnalyticsReport & {
  mix: AnalyticsRank[];
  combinations: AnalyticsRank[];
  trend: {
    label: string;
    frameOnly: number;
    lensOnly: number;
    both: number;
    unclassified: number;
  }[];
};
export type AnalyticsHistoricalYear = {
  year: number;
  purchases: number;
  value: string;
  elapsedValue: string;
  yearOnYear: number | null;
  months: { month: number; purchases: number; value: string }[];
  categories: { name: string; value: string }[];
};
export type AnalyticsHistorical = {
  today: string;
  currentYear: number;
  totalCustomers: number;
  years: AnalyticsHistoricalYear[];
  recent: {
    id: string;
    customerId: string;
    customerName: string;
    frame: string | null;
    lens: string | null;
    value: string;
    purchaseDate: string | null;
  }[];
};
