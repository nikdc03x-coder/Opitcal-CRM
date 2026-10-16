import { Router } from "express";
import { login, currentAdmin, logout } from "../controllers/authController";
import { requireTrustedOrigin } from "../middleware/auth";
import { loginLimiter } from "../middleware/loginLimiter";

const router = Router();
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.use(requireTrustedOrigin);
router.post("/login", loginLimiter, login);
router.get("/me", currentAdmin);
router.post("/logout", logout);

export default router;
