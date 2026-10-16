import type { AnalyticsFilters, AnalyticsHistorical, ExplorerSettings } from "../models/analytics";
import { todayInIndia } from "./dates";

export function defaultAnalyticsFilters(): AnalyticsFilters {
  const today = todayInIndia();
  return {
    period: "month",
    date: today,
    from: `${today.slice(0, 7)}-01`,
    to: today,
    month: today.slice(0, 7),
    year: today.slice(0, 4),
    top: "5",
  };
}
export const defaultExplorer: ExplorerSettings = {
  mode: "monthly",
  chart: "bar",
  year: null,
  compare: false,
  comparison: null,
  range: "last3",
  first: null,
  last: null,
};
export const analyticsColors = [
  "#2563eb",
  "#0f766e",
  "#b45309",
  "#7c3aed",
  "#be185d",
  "#0369a1",
  "#64748b",
];
// nik - Category colors stay stable when ranking order changes or staff move between charts.
export function categoryColor(name: string) {
  const known: Record<string, number> = {
    "Frame Only": 0,
    "Lens Only": 1,
    "Frame + Lens": 2,
    Unclassified: 6,
    "Not Specified": 6,
    Unknown: 6,
    Male: 0,
    Female: 1,
    Other: 2,
  };
  return analyticsColors[
    known[name] ??
      [...name].reduce((hash, letter) => hash + letter.charCodeAt(0), 0) % analyticsColors.length
  ];
}
export const yearColor = (year: number) => `hsl(${(Math.abs(year) * 137.508) % 360} 68% 35%)`;
export const defaultSalesTable = {
  search: "",
  sort: "date" as const,
  direction: "desc" as const,
  page: 0,
  pageSize: 25,
};

// nik - Format exact decimal strings without converting large monetary totals through floating point.
export function analyticsMoney(value: string | number | null | undefined): string {
  const text = String(value ?? "0");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return "₹0.00";
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  return `${text.startsWith("-") ? "−" : ""}₹${new Intl.NumberFormat("en-IN").format(BigInt(whole))}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export const analyticsCount = (value: number) => value.toLocaleString("en-IN");
export function reportParams(
  filters: AnalyticsFilters,
  extra: Record<string, string | number | undefined> = {},
) {
  const params: Record<string, string | number | undefined> = { period: filters.period, ...extra };
  if (filters.period === "date") params.date = filters.date;
  if (filters.period === "custom") {
    params.from = filters.from;
    params.to = filters.to;
  }
  if (filters.period === "selectedMonth") params.month = filters.month;
  if (filters.period === "selectedYear") params.year = filters.year;
  for (const key of [
    "brand",
    "style",
    "model",
    "company",
    "vision",
    "lensName",
    "coating",
    "frame",
    "lens",
    "mix",
    "top",
  ] as const)
    if (filters[key]) params[key] = filters[key];
  return params;
}

// nik - The historical KPI remains previous-year based, independent of the optional chart comparison year.
export function historicalChange(data: AnalyticsHistorical, year: number): number | null {
  return data.years.find((item) => item.year === year)?.yearOnYear ?? null;
}
