import type { Request, Response } from "express";
import {
  createOrder,
  listOrders,
  getOrderById,
  updateOrderDetails,
  updateOrderStatus,
  getOrderSummary,
  getEligiblePurchases,
  deleteOrder,
} from "../services/orderService";
import {
  validateCreateOrder,
  validateUpdateOrder,
  validateOrderStatus,
  validateOrderQuery,
  validateOrderCustomerId,
} from "../validators/orderValidator";

// Express 5 forwards rejected controller promises to the shared error middleware.
export async function addOrder(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await createOrder(validateCreateOrder(req.body)) });
}

export async function showOrders(req: Request, res: Response): Promise<void> {
  const { status, page, pageSize, search } = validateOrderQuery(req.query);
  res.json({ success: true, data: await listOrders(status, page, pageSize, search) });
}

export async function showEligiblePurchases(req: Request, res: Response): Promise<void> {
  const customerId = validateOrderCustomerId(req.query.customerId);
  res.json({ success: true, data: await getEligiblePurchases(customerId) });
}

export async function showOrder(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getOrderById(String(req.params.id)) });
}

export async function removeOrder(req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await deleteOrder(String(req.params.id)) });
}

export async function editOrder(req: Request, res: Response): Promise<void> {
  const input = validateUpdateOrder(req.body);
  res.json({ success: true, data: await updateOrderDetails(String(req.params.id), input) });
}

export async function changeOrderStatus(req: Request, res: Response): Promise<void> {
  const input = validateOrderStatus(req.body);
  res.json({ success: true, data: await updateOrderStatus(String(req.params.id), input) });
}

export async function showOrderSummary(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getOrderSummary() });
}
