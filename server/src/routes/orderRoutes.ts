import { Router } from "express";

import {
  addOrder,
  showOrders,
  showOrder,
  editOrder,
  changeOrderStatus,
  showOrderSummary,
  showEligiblePurchases,
  removeOrder,
} from "../controllers/orderController";

// Staff manage manually created spectacle orders here.
// Admin protection is applied in app.ts.
const router = Router();

// Create an order from an existing purchase.
router.post("/", addOrder);

// List orders with optional status and pagination.
router.get("/", showOrders);

// Get current counts for the Orders page.
router.get("/summary", showOrderSummary);
router.get("/eligible-purchases", showEligiblePurchases);

// View one order with its status history.
router.get("/:id", showOrder);
router.delete("/:id", removeOrder);

// Edit expected delivery date or staff-only notes.
router.patch("/:id", editOrder);

// Move an order to its next status.
router.patch("/:id/status", changeOrderStatus);

export default router;
