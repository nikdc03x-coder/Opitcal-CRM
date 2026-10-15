
import express from "express";
import cors from "cors";

import healthRoutes from "./routes/healthRoutes";
import customerRoutes from "./routes/customerRoutes";
import catalogRoutes from "./routes/catalogRoutes";

import { errorHandler } from "./middleware/errorHandler";

// nik - Only expose development data APIs locally
// until real admin authentication is implemented.
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "1mb" }));

// Health checks can remain publicly reachable.
app.use("/api/health", healthRoutes);

// These APIs must not be publicly deployed before
// authentication and authorization are complete.
if (process.env.NODE_ENV === "development") {
  // Reject requests not connected from this computer.
  // CORS alone does not protect backend write operations.
  app.use("/api/customers", (req, res, next) => {
    const address = req.socket.remoteAddress;

    if (
      address !== "127.0.0.1" &&
      address !== "::1" &&
      address !== "::ffff:127.0.0.1"
    ) {
      res.status(403).json({
        success: false,
        message: "Local development access only.",
      });
      return;
    }

    next();
  }, customerRoutes);

  app.use("/api/catalog", (req, res, next) => {
    const address = req.socket.remoteAddress;

    if (
      address !== "127.0.0.1" &&
      address !== "::1" &&
      address !== "::ffff:127.0.0.1"
    ) {
      res.status(403).json({
        success: false,
        message: "Local development access only.",
      });
      return;
    }

    next();
  }, catalogRoutes);
}

// Handle routes that do not exist.
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

// Keep unexpected error handling last.
app.use(errorHandler);

export default app;
