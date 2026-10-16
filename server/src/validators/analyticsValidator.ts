import { z } from "zod";
import { shopToday } from "../utils/date";
import type { AnalyticsPeriod } from "../models/analytics";
import { HttpError } from "../utils/errors";

export const analyticsPresets = [
  "today",
  "yesterday",
  "last7",
  "month",
  "lastMonth",
  "year",
  "all",
  "date",
  "custom",
  "selectedMonth",
  "selectedYear",
] as const;
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date in YYYY-MM-DD format.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Choose a valid calendar date.");
const scalar = z.string().trim().max(150).optional();
const integer = (max: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(max));
const fields = {
  period: z.enum(analyticsPresets).default("month"),
  date: date.optional(),
  from: date.optional(),
  to: date.optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  year: integer(9999).optional(),
};
export const analyticsQuerySchema = z
  .object({
    ...fields,
    search: z.string().trim().max(100).default(""),
    page: integer(1000000).default(1),
    pageSize: integer(100).default(25),
    sort: z.enum(["date", "customer", "amount"]).default("date"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    brand: scalar,
    style: scalar,
    model: scalar,
    company: scalar,
    vision: scalar,
    lensName: scalar,
    coating: scalar,
    frame: scalar,
    lens: scalar,
    mix: z.enum(["Frame Only", "Lens Only", "Frame + Lens", "Unclassified"]).optional(),
    top: z.enum(["5", "10"]).transform(Number).default(5),
    comparePeriod: z.enum([...analyticsPresets, "previous"]).default("previous"),
    compareDate: date.optional(),
    compareFrom: date.optional(),
    compareTo: date.optional(),
    compareMonth: fields.month,
    compareYear: fields.year,
  })
  .strict();
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

const day = (value: Date) => value.toISOString().slice(0, 10);
const shifted = (value: string, days: number) => {
  const result = new Date(`${value}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return day(result);
};
const monthEnd = (value: string) => {
  const result = new Date(`${value}-01T00:00:00Z`);
  result.setUTCMonth(result.getUTCMonth() + 1, 0);
  return day(result);
};

// nik - Calendar ranges use India for today's date and UTC midnight only as a DATE representation.
export function reportingPeriod(
  input: Pick<AnalyticsQuery, "period" | "date" | "from" | "to" | "month" | "year">,
  now = new Date(),
): AnalyticsPeriod {
  const today = day(shopToday(now));
  let from: string | null = today,
    to: string | null = today;
  switch (input.period) {
    case "all":
      return { from: null, to: null, label: "All Time (includes undated purchases)" };
    case "yesterday":
      from = to = shifted(today, -1);
      break;
    case "last7":
      from = shifted(today, -6);
      break;
    case "month":
      from = `${today.slice(0, 7)}-01`;
      break;
    case "lastMonth":
      to = shifted(`${today.slice(0, 7)}-01`, -1);
      from = `${to.slice(0, 7)}-01`;
      break;
    case "year":
      from = `${today.slice(0, 4)}-01-01`;
      break;
    case "date":
      if (!input.date) throw new HttpError("Choose a specific date.");
      from = to = input.date;
      break;
    case "custom":
      if (!input.from || !input.to) throw new HttpError("Choose both range dates.");
      from = input.from;
      to = input.to;
      break;
    case "selectedMonth":
      if (!input.month) throw new HttpError("Choose a month.");
      from = `${input.month}-01`;
      to = monthEnd(input.month);
      break;
    case "selectedYear":
      if (!input.year) throw new HttpError("Choose a year.");
      from = `${String(input.year).padStart(4, "0")}-01-01`;
      to = `${String(input.year).padStart(4, "0")}-12-31`;
      break;
  }
  if (from > to || from.startsWith("0000") || to.startsWith("0000"))
    throw new HttpError("Choose a valid range with the start date on or before the end date.");
  return { from, to, label: from === to ? from : `${from} to ${to}` };
}

export function precedingPeriod(period: AnalyticsPeriod): AnalyticsPeriod | null {
  if (!period.from || !period.to) return null;
  const length = Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1;
  const to = shifted(period.from, -1),
    from = shifted(to, 1 - length);
  if (!/^\d{4}-/.test(from) || from.startsWith("0000")) return null;
  return { from, to, label: `${from} to ${to}` };
}

export function comparisonPeriod(query: AnalyticsQuery, period: AnalyticsPeriod) {
  if (query.comparePeriod === "previous") {
    const previous = precedingPeriod(period);
    if (!previous) throw new HttpError("Choose dated periods for a period comparison.");
    return previous;
  }
  return reportingPeriod({
    period: query.comparePeriod,
    date: query.compareDate,
    from: query.compareFrom,
    to: query.compareTo,
    month: query.compareMonth,
    year: query.compareYear,
  });
}

export function parseAnalyticsQuery(value: unknown): AnalyticsQuery {
  const result = analyticsQuerySchema.safeParse(value);
  if (!result.success)
    throw new HttpError(result.error.issues[0]?.message ?? "Check the report filters.");
  reportingPeriod(result.data);
  return result.data;
}
