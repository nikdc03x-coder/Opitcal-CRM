
import type { Request, Response } from "express";

import {
  searchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
} from "../services/customerService";

import {
  customerSearchSchema,
  customerIdSchema,
} from "../validators/customerValidator";

import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../validators/customerWriteValidator";

// GET /api/customers
// Return all matching customers by name or phone.
export async function listCustomers(
  req: Request,
  res: Response
) {
  const result = customerSearchSchema.safeParse(req.query);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid search parameters.",
      errors: result.error.flatten(),
    });
    return;
  }

  const { phone, name } = result.data;
  const customers = await searchCustomers(phone, name);

  res.status(200).json({
    success: true,
    count: customers.length,
    data: customers,
  });
}

// GET /api/customers/:id
// Return one customer with their complete details.
export async function showCustomer(
  req: Request,
  res: Response
) {
  const id = customerIdSchema.safeParse(req.params.id);

  if (!id.success) {
    res.status(400).json({
      success: false,
      message: "Invalid customer ID.",
    });
    return;
  }

  const customer = await getCustomerById(id.data);

  if (!customer) {
    res.status(404).json({
      success: false,
      message: "Customer not found.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: customer,
  });
}

// POST /api/customers
// Validate and register the customer in PostgreSQL.
export async function addCustomer(
  req: Request,
  res: Response
) {
  const result = createCustomerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid customer information.",
      errors: result.error.flatten(),
    });
    return;
  }

  const customer = await createCustomer(result.data);

  res.status(201).json({
    success: true,
    message: "Customer created successfully.",
    data: customer,
  });
}

// PATCH /api/customers/:id
// Update an existing customer and return the result.
export async function editCustomer(
  req: Request,
  res: Response
) {
  const id = customerIdSchema.safeParse(req.params.id);

  if (!id.success) {
    res.status(400).json({
      success: false,
      message: "Invalid customer ID.",
    });
    return;
  }

  const result = updateCustomerSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid update information.",
      errors: result.error.flatten(),
    });
    return;
  }

  const customer = await updateCustomer(id.data, result.data);

  if (!customer) {
    res.status(404).json({
      success: false,
      message: "Customer not found.",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "Customer updated successfully.",
    data: customer,
  });
}
