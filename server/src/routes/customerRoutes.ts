
import { Router } from "express";

import {
  listCustomers,
  showCustomer,
  addCustomer,
  editCustomer,
} from "../controllers/customerController";

import {
  editPurchase,
  editPrescription,
} from "../controllers/historyController";

// nik - Customer routes for the Optical CRM.
const router = Router();

// Search customers by name or mobile number.
router.get("/", listCustomers);

// Register a new customer.
router.post("/", addCustomer);

// View one customer using their unique ID.
router.get("/:id", showCustomer);

// Edit a customer's personal information.
router.patch("/:id", editCustomer);

// Edit one specific purchase, including its purchase date.
router.patch("/:id/records/:recordId", editPurchase);

// Edit one specific prescription from the customer's history.
router.patch(
  "/:id/prescriptions/:prescriptionId",
  editPrescription
);

export default router;
