
import { Request, Response } from "express";
import {
  searchCustomers,
  getCustomerById,
} from "../services/customerService";
import {
  customerSearchSchema,
  customerIdSchema,
} from "../validators/customerValidator";

// GET /api/customers
// Search customers using name or mobile number.
export async function listCustomers(
  req: Request,
  res: Response
) {
  const result = customerSearchSchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid search parameters",
    });
    return;
  }

  const { phone, name } = result.data;

  const customers = await searchCustomers(phone, name);

  res.json({
    success: true,
    count: customers.length,
    data: customers,
  });
}

// GET /api/customers/:id
// Open the selected customer's complete profile.
export async function showCustomer(
  req: Request,
  res: Response
) {
  const parsedId = customerIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    res.status(400).json({
      success: false,
      message: "Invalid customer ID",
    });
    return;
  }

  const customer = await getCustomerById(parsedId.data);

  if (!customer) {
    res.status(404).json({
      success: false,
      message: "Customer not found",
    });
    return;
  }

  res.json({
    success: true,
    data: customer,
  });
}
