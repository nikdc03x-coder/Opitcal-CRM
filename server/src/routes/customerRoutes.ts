import { Router } from "express";
import { deleteData, restoreData, showTrash } from "../controllers/deletionController";
import { permanentlyDelete } from "../controllers/permanentDeletionController";
import { deletionPinLimiter } from "../middleware/deletionPinLimiter";

import {
  listCustomers,
  showCustomer,
  addCustomer,
  editCustomer,
} from "../controllers/customerController";

import { editPurchase, editPrescription, addPurchase } from "../controllers/historyController";

// Customer routes for the Optical CRM.
const router = Router();
router.get("/trash", showTrash);
router.delete("/:id/permanent", deletionPinLimiter, permanentlyDelete);
router.delete("/:id/records/:recordId/permanent", deletionPinLimiter, permanentlyDelete);
router.delete("/:id", deleteData);
router.delete("/:id/records/:recordId", deleteData);
router.post("/:id/restore", restoreData);
router.post("/:id/records/:recordId/restore", restoreData);

// Search customers by name or mobile number.
router.get("/", listCustomers);

// Register a new customer.
router.post("/", addCustomer);

// View one customer using their unique ID.
router.get("/:id", showCustomer);

// Edit a customer's personal information.
router.patch("/:id", editCustomer);

// Add a new purchase record to an existing customer.
router.post("/:id/records", addPurchase);

// Edit one specific purchase, including its purchase date.
router.patch("/:id/records/:recordId", editPurchase);

// Edit one specific prescription from the customer's history.
router.patch("/:id/prescriptions/:prescriptionId", editPrescription);

export default router;
