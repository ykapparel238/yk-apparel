import { Router } from "express";
import { z } from "zod";
import {
  authenticateUser,
  createSession,
  destroySession,
  findSessionByToken,
  findSessionUser,
  getSessionCookieName,
  getSessionCookieOptions,
  serializeUser,
} from "../auth.mjs";
import { prisma } from "../db.mjs";
import { writeAuditLog } from "../audit.mjs";
import { fail, ok, asyncHandler } from "../http.mjs";
import { createRateLimiter } from "../rate-limit.mjs";
import { getEnv } from "../env.mjs";

const router = Router();
const env = getEnv();
const loginRateLimiter = createRateLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  code: "LOGIN_RATE_LIMITED",
  message: "Too many login attempts. Please try again shortly.",
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const impersonationSchema = z.object({
  role: z.enum(["ADMIN", "FACTORY_MANAGER", "PRODUCTION_PLANNER", "MERCHANDISER", "QA_MANAGER", "STORE_MANAGER", "LINE_SUPERVISOR", "VENDOR_MANAGER", "DISPATCH_MANAGER"]),
});

router.post("/login", loginRateLimiter, asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid login payload", "INVALID_LOGIN_PAYLOAD", parsed.error.flatten());
  }

  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return fail(res, 401, "Incorrect email or password", "INVALID_CREDENTIALS");
  }

  const session = await createSession(user.id);
  res.cookie(getSessionCookieName(), session.rawToken, getSessionCookieOptions(session.expiresAt));

  return ok(res, { user: serializeUser(user) });
}));

router.post("/logout", asyncHandler(async (req, res) => {
  await destroySession(req.cookies[getSessionCookieName()]);
  res.clearCookie(getSessionCookieName(), getSessionCookieOptions(new Date(0)));
  return res.status(204).send();
}));

router.get("/session", asyncHandler(async (req, res) => {
  const user = await findSessionUser(req.cookies[getSessionCookieName()]);
  if (!user) {
    return fail(res, 401, "No active session", "NO_ACTIVE_SESSION");
  }

  return ok(res, { user: serializeUser(user) });
}));

router.post("/impersonation", asyncHandler(async (req, res) => {
  const user = await findSessionUser(req.cookies[getSessionCookieName()]);
  if (!user) return fail(res, 401, "Authentication required", "AUTH_REQUIRED");
  if ((user.actualRole ?? user.role) !== "ADMIN") return fail(res, 403, "Only admins can impersonate roles", "FORBIDDEN");

  const parsed = impersonationSchema.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, "Invalid impersonation payload", "INVALID_IMPERSONATION_PAYLOAD", parsed.error.flatten());
  }

  const session = await findSessionByToken(req.cookies[getSessionCookieName()]);
  if (!session) return fail(res, 401, "No active session", "NO_ACTIVE_SESSION");

  await prisma.session.update({
    where: { id: session.id },
    data: { impersonatedRole: parsed.data.role },
  });

  await writeAuditLog({ ...req, sessionUser: user }, {
    module: "Auth",
    action: "Started role impersonation",
    targetType: "Session",
    targetId: session.id,
    targetLabel: parsed.data.role,
  });

  const nextUser = await findSessionUser(req.cookies[getSessionCookieName()]);
  return ok(res, { user: serializeUser(nextUser) });
}));

router.delete("/impersonation", asyncHandler(async (req, res) => {
  const user = await findSessionUser(req.cookies[getSessionCookieName()]);
  if (!user) return fail(res, 401, "Authentication required", "AUTH_REQUIRED");
  if ((user.actualRole ?? user.role) !== "ADMIN") return fail(res, 403, "Only admins can clear impersonation", "FORBIDDEN");

  const session = await findSessionByToken(req.cookies[getSessionCookieName()]);
  if (!session) return fail(res, 401, "No active session", "NO_ACTIVE_SESSION");

  await prisma.session.update({
    where: { id: session.id },
    data: { impersonatedRole: null },
  });

  await writeAuditLog({ ...req, sessionUser: user }, {
    module: "Auth",
    action: "Cleared role impersonation",
    targetType: "Session",
    targetId: session.id,
    targetLabel: "ADMIN",
  });

  const nextUser = await findSessionUser(req.cookies[getSessionCookieName()]);
  return ok(res, { user: serializeUser(nextUser) });
}));

export default router;
