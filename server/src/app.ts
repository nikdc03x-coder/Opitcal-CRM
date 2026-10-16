import express from "express";
import cors from "cors";

import healthRoutes from "./routes/healthRoutes";
import authRoutes from "./routes/authRoutes";
import customerRoutes from "./routes/customerRoutes";
import catalogRoutes from "./routes/catalogRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";

// New manual spectacle order tracking endpoints.
import orderRoutes from "./routes/orderRoutes";

import { requireAdmin } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { clientOrigin } from "./config/authConfig";

// Create and configure the CRM application.
const app = express();
app.disable("x-powered-by");
app.disable("etag");
const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5)
  throw new Error("TRUST_PROXY_HOPS must be between 0 and 5.");
app.set("trust proxy", proxyHops);

const clientUrl = clientOrigin();

// Allow the frontend to send session cookies.
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// Health checks don't require login.
app.use("/api/health", healthRoutes);

// Login, logout and current Admin session.
app.use("/api/auth", authRoutes);

// Dashboard statistics require Admin access.
app.use("/api/dashboard", requireAdmin, dashboardRoutes);

// Customer information and purchase history.
app.use("/api/customers", requireAdmin, customerRoutes);

// Frame and lens catalog.
app.use("/api/catalog", requireAdmin, catalogRoutes);

// Only authenticated admins can manage spectacle orders.
app.use("/api/orders", requireAdmin, orderRoutes);

// Handle unknown API routes.
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

// Keep error handling last.
app.use(errorHandler);

export default app;
