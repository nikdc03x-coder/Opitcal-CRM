import type { Request, Response } from "express";
import { parseAnalyticsQuery, reportingPeriod } from "../validators/analyticsValidator";
import * as analytics from "../services/analyticsService";

export const analyticsHandlers = {
  overview: analytics.getAnalyticsOverview,
  purchases: analytics.getAnalyticsPurchases,
  comparison: analytics.getAnalyticsComparison,
  customers: analytics.getAnalyticsCustomers,
  mix: analytics.getAnalyticsMix,
  frames: (query: ReturnType<typeof parseAnalyticsQuery>) =>
    analytics.getAnalyticsProducts(query, "frames"),
  lenses: (query: ReturnType<typeof parseAnalyticsQuery>) =>
    analytics.getAnalyticsProducts(query, "lenses"),
};
export function reportHandler(report: keyof typeof analyticsHandlers) {
  return async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: await analyticsHandlers[report](parseAnalyticsQuery(req.query)),
    });
  };
}
export async function historicalReport(_req: Request, res: Response) {
  res.json({ success: true, data: await analytics.getAnalyticsHistorical() });
}
export async function exportPurchases(req: Request, res: Response) {
  const query = parseAnalyticsQuery(req.query);
  reportingPeriod(query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="optilens-purchases.csv"');
  // nik - Respect browser cancellation and response backpressure during large authorized exports.
  await analytics.exportAnalyticsPurchases(query, async (chunk) => {
    if (res.destroyed) return false;
    if (res.write(chunk)) return true;
    return new Promise<boolean>((resolve) => {
      const cleanup = () => {
        res.off("drain", drained);
        res.off("close", closed);
      };
      const drained = () => {
        cleanup();
        resolve(true);
      };
      const closed = () => {
        cleanup();
        resolve(false);
      };
      res.once("drain", drained);
      res.once("close", closed);
    });
  });
  if (!res.destroyed) res.end();
}
