import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { deleteCustomerData, restoreCustomerData, listTrash } from "../services/deletionService";

const paramsSchema = z.object({ id: z.string().uuid(), recordId: z.string().uuid().optional() });
function action(restore: boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = paramsSchema.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ success: false, message: "Invalid customer or purchase ID." });
        return;
      }
      const data = await (restore ? restoreCustomerData : deleteCustomerData)(
        params.data.id,
        params.data.recordId,
      );
      res.json({
        success: true,
        message: `${params.data.recordId ? "Purchase" : "Customer"} ${restore ? "restored" : "deleted"} successfully.`,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
export const deleteData = action(false);
export const restoreData = action(true);
export async function showTrash(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await listTrash() });
  } catch (error) {
    next(error);
  }
}
