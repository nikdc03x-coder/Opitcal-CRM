
import { Router } from "express";
import {
  listCustomers,
  showCustomer,
} from "../controllers/customerController";

// Connect customer URLs with their controllers.
const router = Router();

router.get("/", listCustomers);
router.get("/:id", showCustomer);

export default router;
