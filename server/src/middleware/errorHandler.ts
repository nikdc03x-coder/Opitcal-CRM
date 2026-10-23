import { ErrorRequestHandler } from "express";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../utils/errors";
import { logError } from "../utils/logError";

// Handle unexpected server errors in one place.
// Detailed errors are logged on the server,
// rather than exposed to application users.
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2028") {
      logError("Database transaction could not finish", error);
      res.status(503).json({
        success: false,
        message: "The database transaction could not finish. Please try again.",
      });
      return;
    }
    // nik - Missing migrations need an administrator action, not repeated customer submissions.
    if (["P2021", "P2022"].includes(error.code)) {
      logError("Database schema update required", error);
      res.status(503).json({
        success: false,
        message:
          "A database update is required before this information can be saved or loaded. Please ask an administrator to apply the pending migrations, then try again.",
      });
      return;
    }
    if (error.code === "P2002") {
      res
        .status(409)
        .json({ success: false, message: "A record already exists with these details." });
      return;
    }
    if (["P2034", "P2003"].includes(error.code)) {
      res
        .status(409)
        .json({ success: false, message: "The record changed recently. Refresh and try again." });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ success: false, message: "Record not found." });
      return;
    }
  }

  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Invalid JSON body." });
    return;
  }

  if (error?.type === "entity.too.large") {
    res.status(413).json({ success: false, message: "Request body is too large." });
    return;
  }

  logError("API request failed", error);

  if (
    [
      "P1001",
      "P1002",
      "P1008",
      "P1017",
      "P2024",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
    ].includes(error?.code)
  ) {
    res.status(503).json({
      success: false,
      message: "The database is temporarily unavailable. Please try again.",
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
};
