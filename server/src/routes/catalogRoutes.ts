
import { Router } from "express";

import {
  getFrames,
  addFrame,
  editFrame,
  getLenses,
  addLens,
  editLens,
} from "../controllers/catalogController";

// nik - Local development catalog management API.
const router = Router();

// Frame catalog.
router.get("/frames", getFrames);
router.post("/frames", addFrame);
router.patch("/frames/:id", editFrame);

// Lens catalog.
router.get("/lenses", getLenses);
router.post("/lenses", addLens);
router.patch("/lenses/:id", editLens);

export default router;
