import { rateLimit } from "express-rate-limit";

export const deletionPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many permanent deletion requests. Try again in 15 minutes.",
  },
});
