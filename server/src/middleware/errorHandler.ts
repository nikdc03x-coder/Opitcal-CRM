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

  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Invalid JSON body." });
    return;
  }

  if (error?.type === "entity.too.large") {
    res.status(413).json({ success: false, message: "Request body is too large." });
    return;
  }

  if (error instanceof Error && error.message === "CORS blocked") {
    res.status(403).json({ success: false, message: "Untrusted request origin." });
    return;
  }

  const isHttpError =
    error instanceof HttpError ||
    (typeof error === "object" &&
      error !== null &&
      ("statusCode" in error || "status" in error) &&
      ((error as any).name === "HttpError" ||
        (error as any).name === "OrderInputError" ||
        (error as any).name === "CatalogSelectionError"));

  if (isHttpError) {
    const statusCode = (error as any).statusCode ?? (error as any).status ?? 400;
    res.status(statusCode).json({ success: false, message: (error as any).message });
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

  logError("API request failed", error);

  const dbCode =
    typeof error === "object" && error !== null
      ? ((error as any).code ??
        (error as any).errorCode ??
        (typeof (error as any).cause === "object" && (error as any).cause !== null
          ? (error as any).cause.code
          : undefined))
      : undefined;

  const isDbUnavailable =
    (typeof dbCode === "string" &&
      [
        "P1000",
        "P1001",
        "P1002",
        "P1008",
        "P1017",
        "P2024",
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
      ].includes(dbCode)) ||
    (error instanceof Error &&
      /timeout exceeded when trying to connect|connection terminated unexpectedly|connection timeout/i.test(
        error.message,
      ));

  if (isDbUnavailable) {
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
