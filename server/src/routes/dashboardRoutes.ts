import { Router } from "express";
import { showDashboard } from "../controllers/dashboardController";

const router = Router();
router.get("/", showDashboard);

export default router;
