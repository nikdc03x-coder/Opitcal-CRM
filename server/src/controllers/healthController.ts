
import { Request, Response } from "express";
import { getHealthStatus } from "../services/healthService";

// Controller: receive the request and return
// the response prepared by the service.
export function healthCheck(req: Request, res: Response) {
  const result = getHealthStatus();

  res.status(200).json(result);
}
