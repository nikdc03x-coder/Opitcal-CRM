
import { ErrorRequestHandler } from "express";

// Handle unexpected server errors in one place.
// Detailed errors are logged on the server,
// rather than exposed to application users.
export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next
) => {
  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
};
