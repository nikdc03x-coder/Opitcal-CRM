
import express from "express";
import cors from "cors";
import healthRoutes from "./routes/healthRoutes";
import { errorHandler } from "./middleware/errorHandler";

// Create the main Express application.
const app = express();

// Allow requests from our React frontend.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

// Read incoming JSON request bodies.
app.use(express.json({ limit: "1mb" }));

// Register all health-related routes.
app.use("/api/health", healthRoutes);

// Return a clear message for unknown API routes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Handle application errors in one place.
app.use(errorHandler);

export default app;
