import { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../config/database";
import { requireTrustedOrigin } from "../middleware/auth";
import { requireAccount, requireAccountAdmin } from "../middleware/accountAuth";
import { clearSessionCookies } from "../utils/sessionCookie";
import { HttpError } from "../utils/errors";
import {
  changePasswordSchema,
  emailSchema,
  profileSchema,
  resetPasswordSchema,
  userSchema,
} from "../validators/accountValidator";
import {
  accountSelect,
  changePassword,
  completePasswordReset,
  requestPasswordReset,
  RESET_MESSAGE,
  saveUser,
  updateProfile,
  validateResetToken,
} from "../services/accountService";
import { requireResetEmailConfig } from "../services/resetEmailService";

function parse<T>(schema: z.ZodType<T>, req: Request): T {
  const result = schema.safeParse(req.body);
  if (!result.success)
    throw new HttpError(result.error.issues[0]?.message || "Invalid account details.");
  return result.data;
}
const limiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts. Try again in 15 minutes." },
  });
const publicRouter = Router();
publicRouter.use(requireTrustedOrigin);
publicRouter.post("/forgot-password", limiter(), async (req, res) => {
  const { email } = parse(z.object({ email: emailSchema }), req);
  // Equalize normal known/unknown response timing; provider failures remain private.
  const started = Date.now();
  await requestPasswordReset(email);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1200 - (Date.now() - started))));
  res.json({ success: true, message: RESET_MESSAGE });
});
publicRouter.post("/reset-password/verify", limiter(), async (req, res) => {
  const { token } = parse(z.object({ token: z.string().max(64) }), req);
  await validateResetToken(token);
  res.json({ success: true });
});
publicRouter.post("/reset-password", limiter(), async (req, res) => {
  const { token, newPassword } = parse(resetPasswordSchema, req);
  await completePasswordReset(token, newPassword);
  clearSessionCookies(res);
  res.json({
    success: true,
    message: "Password reset successfully. Sign in with your new password.",
  });
});

const router = Router();
router.use(requireTrustedOrigin, requireAccount);
router.get("/me", async (_req, res) => {
  const account = await prisma.admin.findUniqueOrThrow({
    where: { id: res.locals.account.id },
    select: accountSelect,
  });
  res.json({ success: true, account });
});
router.patch("/me", limiter(), async (req, res) => {
  const { name, email, currentPassword } = parse(profileSchema, req);
  const account = await updateProfile(res.locals.account.id, name, email, currentPassword);
  res.json({ success: true, account, message: "Account details saved." });
});
router.post("/me/password", limiter(), async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req);
  await changePassword(res.locals.account.id, currentPassword, newPassword);
  clearSessionCookies(res);
  res.json({ success: true, message: "Password changed. Sign in again on all devices." });
});
router.use("/users", requireAccountAdmin);
router.get("/users", async (_req, res) => {
  res.json({
    success: true,
    users: await prisma.admin.findMany({ select: accountSelect, orderBy: { id: "asc" } }),
  });
});
router.post("/users", limiter(), async (req, res) => {
  const input = parse(userSchema, req);
  requireResetEmailConfig();
  const user = await saveUser(res.locals.account.id, input);
  await requestPasswordReset(input.email);
  res.status(201).json({
    success: true,
    user,
    message: "User created. A password setup email has been requested for the active account.",
  });
});
function userId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError("Invalid user ID.");
  return id;
}
router.patch("/users/:id", limiter(), async (req, res) => {
  const user = await saveUser(res.locals.account.id, parse(userSchema, req), userId(req.params.id));
  res.json({ success: true, user, message: "User updated." });
});
router.post("/users/:id/reset-password", limiter(), async (req, res) => {
  const user = await prisma.admin.findUniqueOrThrow({
    where: { id: userId(req.params.id) },
    select: accountSelect,
  });
  if (!user.isActive || !user.email)
    throw new HttpError("An active account with an email address is required.");
  await requestPasswordReset(user.email);
  res.json({
    success: true,
    message: "Password reset email requested. The link expires in 30 minutes.",
  });
});
export { publicRouter as passwordRoutes };
export default router;
