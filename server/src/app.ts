
import express from "express";
import cors from "cors";

import healthRoutes from "./routes/healthRoutes";
import customerRoutes from "./routes/customerRoutes";
import { errorHandler } from "./middleware/errorHandler";

// Create the Express application.
const app = express();

// Only allow our React development frontend.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

// Parse JSON data from incoming requests.
app.use(express.json({ limit: "1mb" }));

// Register application API routes.
app.use("/api/health", healthRoutes);

// Customer routes are development-only until
// authentication and authorization are implemented.
// Do not publish these APIs to the internet yet.
if (process.env.NODE_ENV === "development") {
  app.use("/api/customers", customerRoutes);
}

// Handle unknown API routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Handle unexpected application errors.
app.use(errorHandler);

export default app;
