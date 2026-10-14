
import { Router } from "express";

import {
  listCustomers,
  showCustomer,
  addCustomer,
  editCustomer,
} from "../controllers/customerController";

// Connect the customer API to the correct controller.
const router = Router();

// List and search customers.
router.get("/", listCustomers);

// Register a customer with prescription and pricing.
router.post("/", addCustomer);

// Get one customer's details.
router.get("/:id", showCustomer);

// Edit customer details.
router.patch("/:id", editCustomer);

export default router;
