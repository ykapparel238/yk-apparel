import { Router } from "express";
import { z } from "zod";
import {
  authenticateUser,
  createSession,
  destroySession,
  findSessionUser,
  getSessionCookieName,
  getSessionCookieOptions,
  serializeUser,
} from "../auth.mjs";
import { fail, ok, asyncHandler } from "../http.mjs";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/login", asyncHandler(async (req, res) => {
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

export default router;
