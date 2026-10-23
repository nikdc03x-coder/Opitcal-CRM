import type { RequestHandler } from "express";
import { z } from "zod";
import { verifyDeletionPin } from "../services/deletionPinService";
import { permanentlyDeleteData } from "../services/permanentDeletionService";
import { HttpError } from "../utils/errors";

const paramsSchema = z.object({ id: z.string().uuid(), recordId: z.string().uuid().optional() });
const bodySchema = z.object({ pin: z.string().regex(/^\d{4}$/) }).strict();
export const permanentlyDelete: RequestHandler = async (req, res, next) => {
  try {
    if (!Number.isInteger(res.locals.adminId)) throw new HttpError("Admin login required.", 401);
    if (res.locals.adminRole !== "ADMIN")
      throw new HttpError("Administrator access required.", 403);
    const params = paramsSchema.safeParse(req.params);
    const body = bodySchema.safeParse(req.body);
    if (!params.success || !body.success || Object.keys(req.query).length)
      throw new HttpError(
        "Provide valid record IDs and a four-digit PIN in the request body.",
        400,
      );
    await verifyDeletionPin(res.locals.adminId as number, body.data.pin);
    const data = await permanentlyDeleteData(params.data.id, params.data.recordId);
    res.json({ success: true, message: "Record permanently deleted.", data });
  } catch (error) {
    next(error);
  }
};
