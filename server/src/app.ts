
import express from "express";
import cors from "cors";

import healthRoutes from "./routes/healthRoutes";
import authRoutes from "./routes/authRoutes";
import customerRoutes from "./routes/customerRoutes";
import catalogRoutes from "./routes/catalogRoutes";

import { requireAdmin } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import dashboardRoutes from "./routes/dashboardRoutes";
// nik - Create and configure the CRM application.
const app = express();

const clientUrl =
  process.env.CLIENT_URL || "http://localhost:5173";

// nik - Allow the frontend to send session cookies.
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

// nik - Health checks don't require login.
app.use("/api/health", healthRoutes);

// nik - Login, logout and current Admin session.
app.use("/api/auth", authRoutes);
// nik - Dashboard statistics require Admin access.
app.use("/api/dashboard", requireAdmin, dashboardRoutes);
// nik - These routes require Admin authentication.
// Local development access is handled inside requireAdmin.
app.use("/api/customers", requireAdmin, customerRoutes);
app.use("/api/catalog", requireAdmin, catalogRoutes);

// nik - Handle unknown API routes.
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

// nik - Keep error handling last.
app.use(errorHandler);

export default app;
