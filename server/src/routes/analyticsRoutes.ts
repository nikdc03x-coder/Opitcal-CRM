import { Router } from "express";
import {
  analyticsHandlers,
  exportPurchases,
  historicalReport,
  reportHandler,
} from "../controllers/analyticsController";

// nik - The app mounts this read-only router behind the existing admin/session middleware.
const router = Router();
router.get("/historical", historicalReport);
router.get("/purchases.csv", exportPurchases);
for (const report of Object.keys(analyticsHandlers) as (keyof typeof analyticsHandlers)[]) {
  router.get(`/${report}`, reportHandler(report));
}
export default router;
