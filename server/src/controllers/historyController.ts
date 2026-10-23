import type { Request, Response, NextFunction } from "express";

import { z } from "zod";

import {
  purchaseUpdateSchema,
  prescriptionUpdateSchema,
  createPurchaseRecordSchema,
} from "../validators/historyValidator";

import {
  updateCustomerPurchase,
  updateCustomerPrescription,
  addCustomerPurchase,
} from "../services/customerHistoryService";

// Validate the IDs before querying PostgreSQL.
const paramsSchema = z.object({
  id: z.string().uuid(),
  recordId: z.string().uuid().optional(),
  prescriptionId: z.string().uuid().optional(),
});

// Add a new purchase record for an existing customer.
export async function addPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paramsSchema.safeParse(req.params);
    const body = createPurchaseRecordSchema.safeParse(req.body);

    if (!params.success || !body.success) {
      res.status(400).json({
        success: false,
        message: !params.success
          ? "Invalid customer ID."
          : !body.success
            ? body.error.issues[0]?.message
            : "Invalid purchase details.",
        errors: body.success ? undefined : body.error.flatten(),
      });
      return;
    }

    const record = await addCustomerPurchase(params.data.id, body.data);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Purchase added successfully.",
      data: record,
    });
  } catch (error) {
    next(error);
  }
}

// Update one selected purchase record.
export async function editPurchase(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paramsSchema.safeParse(req.params);
    const body = purchaseUpdateSchema.safeParse(req.body);

    if (!params.success || !params.data.recordId || !body.success) {
      res.status(400).json({
        success: false,
        message: "Invalid purchase ID or purchase details.",
        errors: body.success ? undefined : body.error.flatten(),
      });
      return;
    }

    const record = await updateCustomerPurchase(params.data.id, params.data.recordId, body.data);

    if (!record) {
      res.status(404).json({
        success: false,
        message: "Purchase record not found.",
      });
      return;
    }

    res.json({
      success: true,
      message: "Purchase updated successfully.",
      data: record,
    });
  } catch (error) {
    next(error);
  }
}

// Update one selected prescription.
export async function editPrescription(req: Request, res: Response, next: NextFunction) {
  try {
    const params = paramsSchema.safeParse(req.params);
    const body = prescriptionUpdateSchema.safeParse(req.body);

    if (!params.success || !params.data.prescriptionId || !body.success) {
      res.status(400).json({
        success: false,
        message: "Invalid prescription ID or measurements.",
        errors: body.success ? undefined : body.error.flatten(),
      });
      return;
    }

    const prescription = await updateCustomerPrescription(
      params.data.id,
      params.data.prescriptionId,
      body.data,
    );

    if (!prescription) {
      res.status(404).json({
        success: false,
        message: "Prescription not found.",
      });
      return;
    }

    res.json({
      success: true,
      message: "Prescription updated successfully.",
      data: prescription,
    });
  } catch (error) {
    next(error);
  }
}
