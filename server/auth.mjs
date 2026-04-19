import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "./db.mjs";
import { getEnv } from "./env.mjs";

const SESSION_COOKIE = "kc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
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
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };
}

function prettifyEnum(value) {
  if (value === "QA") return "QA";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      if (part === "qa") return "QA";
      if (part === "otif") return "OTIF";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export async function createSession(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

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

export async function findSessionUser(rawToken) {
  if (!rawToken) return null;

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: sha256(rawToken),
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!session?.user) return null;
  if (!session.user.lastActiveAt || Date.now() - new Date(session.user.lastActiveAt).getTime() > LAST_ACTIVE_INTERVAL_MS) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() },
    });
    session.user.lastActiveAt = new Date();
  }
  return session.user;
}

export function serializeUser(user) {
  return {
    id: user.id,
    employeeCode: user.employeeCode,
    name: user.name,
    email: user.email,
    role: prettifyEnum(user.role),
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
