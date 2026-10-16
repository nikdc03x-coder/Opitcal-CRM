// nik - Type-only exports keep the API contract aligned without shipping backend code to the browser.
export type * from "../../../server/src/models/analytics";
export type AnalyticsSection = "overview" | "sales" | "frames" | "lenses" | "customers" | "mix";
export type AnalyticsFilters = {
  period: string;
  date: string;
  from: string;
  to: string;
  month: string;
  year: string;
  brand?: string;
  style?: string;
  model?: string;
  company?: string;
  vision?: string;
  lensName?: string;
  coating?: string;
  frame?: string;
  lens?: string;
  mix?: string;
  top?: string;
};
export type ExplorerSettings = {
  mode: "monthly" | "yearly";
  chart: "bar" | "line" | "pie";
  year: number | null;
  compare: boolean;
  comparison: number | null;
  range: "last3" | "last5" | "all" | "custom";
  first: number | null;
  last: number | null;
};
