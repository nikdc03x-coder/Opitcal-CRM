import type { Request, Response } from "express";
import { getDashboardAnalytics } from "../services/dashboardService";

export async function showDashboard(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getDashboardAnalytics() });
}
