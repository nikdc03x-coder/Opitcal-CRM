
import { Router } from "express";
import { getDashboardAnalytics } from "../services/dashboardService";

const router = Router();

// nik - Provide dashboard statistics from PostgreSQL.
// Authentication is handled by requireAdmin in app.ts.
router.get("/", async (_req, res, next) => {
  try {
    const data = await getDashboardAnalytics();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
