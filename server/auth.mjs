import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "./db.mjs";
import { getEnv } from "./env.mjs";
import { formatEnumLabel } from "./constants.mjs";

const SESSION_COOKIE = "kc_session";
const LAST_ACTIVE_INTERVAL_MS = 1000 * 60 * 5;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionCookieOptions(expiresAt) {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

export async function createSession(userId) {
  const env = getEnv();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export async function destroySession(rawToken) {
  if (!rawToken) return;
  await prisma.session.deleteMany({
    where: {
      tokenHash: sha256(rawToken),
    },
  });
}

export async function findSessionByToken(rawToken) {
  if (!rawToken) return null;
  return prisma.session.findFirst({
    where: {
      tokenHash: sha256(rawToken),
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

export async function findSessionUser(rawToken) {
  if (!rawToken) return null;

  const session = await findSessionByToken(rawToken);

  if (!session?.user) return null;
  if (!session.user.lastActiveAt || Date.now() - new Date(session.user.lastActiveAt).getTime() > LAST_ACTIVE_INTERVAL_MS) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() },
    });
    session.user.lastActiveAt = new Date();
  }
  session.user.actualRole = session.user.role;
  session.user.effectiveRole = session.impersonatedRole ?? session.user.role;
  session.user.impersonatedRole = session.impersonatedRole;
  return session.user;
}

export function serializeUser(user) {
  const actualRole = user.actualRole ?? user.role;
  const effectiveRole = user.effectiveRole ?? user.role;
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    email: user.email,
    role: formatEnumLabel(effectiveRole),
    actualRole: formatEnumLabel(actualRole),
    effectiveRole: formatEnumLabel(effectiveRole),
    impersonatedRole: user.impersonatedRole ? formatEnumLabel(user.impersonatedRole) : null,
    canImpersonate: actualRole === "ADMIN",
  };
}

export async function authenticateUser(email, password) {
  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim(),
    },
  });

  if (!user) return null;
  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });
  return user;
}
