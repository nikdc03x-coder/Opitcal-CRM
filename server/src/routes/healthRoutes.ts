
import { Router } from "express";
import { healthCheck } from "../controllers/healthController";

// Routes connect API URLs with controller functions.
const router = Router();

router.get("/", healthCheck);

export default router;
