import { Router } from "express";

import {
  getFrames,
  addFrame,
  editFrame,
  getLenses,
  addLens,
  editLens,
  removeFrame,
  removeLens,
} from "../controllers/catalogController";

// Local development catalog management API.
const router = Router();

// Frame catalog.
router.get("/frames", getFrames);
router.post("/frames", addFrame);
router.patch("/frames/:id", editFrame);
router.delete("/frames/:id", removeFrame);

// Lens catalog.
router.get("/lenses", getLenses);
router.post("/lenses", addLens);
router.patch("/lenses/:id", editLens);
router.delete("/lenses/:id", removeLens);

export default router;
