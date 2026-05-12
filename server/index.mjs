import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { prisma } from "./db.mjs";
import { getEnv } from "./env.mjs";
import { findSessionUser, getSessionCookieName, serializeUser } from "./auth.mjs";
import { ApiError, fail } from "./http.mjs";
import { logError, logInfo, requestLogger } from "./logger.mjs";
import authRoutes from "./routes/auth.mjs";
import assetsRoutes from "./routes/assets.mjs";
import dispatchRoutes from "./routes/dispatch.mjs";
import dashboardRoutes from "./routes/dashboard.mjs";
import inventoryRoutes from "./routes/inventory.mjs";
import mastersRoutes from "./routes/masters.mjs";
import mrpRoutes from "./routes/mrp.mjs";
import ordersRoutes from "./routes/orders.mjs";
import planningRoutes from "./routes/planning.mjs";
import productionRoutes from "./routes/production.mjs";
import qaRoutes from "./routes/qa.mjs";
import reportsRoutes from "./routes/reports.mjs";
import settingsRoutes from "./routes/settings.mjs";
import syncRoutes from "./routes/sync.mjs";
import vendorsRoutes from "./routes/vendors.mjs";
import { ensureUploadDirectory, getUploadLocalDir } from "./storage.mjs";

const app = express();
const env = getEnv();
const port = env.API_PORT;
const configuredOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((item) => item.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

for (const origin of configuredOrigins) {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      allowedOrigins.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`);
    }
    if (url.hostname === "127.0.0.1") {
      allowedOrigins.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`);
    }
  } catch {
    // Keep existing configured origin behavior for non-URL entries.
  }
}

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(express.json());
app.use(cookieParser());
ensureUploadDirectory();
app.use("/uploads", express.static(getUploadLocalDir()));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, environment: env.NODE_ENV });
});

app.get("/api/health/db", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const migrationCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`);
    res.json({ ok: true, db: "up", migrations: migrationCount?.[0]?.count ?? null });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);

app.use("/api", async (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path === "/health") return next();

  const user = await findSessionUser(req.cookies[getSessionCookieName()]);
  if (!user) {
    return fail(res, 401, "Authentication required", "AUTH_REQUIRED");
  }

  req.sessionUser = user;
  req.user = serializeUser(user);
  return next();
});

app.use("/api", (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();

  const role = req.sessionUser?.role;
  const policies = [
    { prefix: "/masters", roles: ["ADMIN"] },
    { prefix: "/assets", roles: ["ADMIN"] },
    { prefix: "/settings", roles: ["ADMIN"] },
    { prefix: "/inventory", roles: ["ADMIN", "STORE_MANAGER"] },
    { prefix: "/qa", roles: ["ADMIN", "QA_MANAGER"] },
    { prefix: "/dispatch", roles: ["ADMIN", "DISPATCH_MANAGER", "FACTORY_MANAGER"] },
    { prefix: "/vendors", roles: ["ADMIN", "VENDOR_MANAGER", "FACTORY_MANAGER"] },
    { prefix: "/planning", roles: ["ADMIN", "PRODUCTION_PLANNER", "FACTORY_MANAGER"] },
    { prefix: "/orders", roles: ["ADMIN", "MERCHANDISER", "PRODUCTION_PLANNER", "FACTORY_MANAGER"] },
  ];

  const policy = policies.find((item) => req.path.startsWith(item.prefix));
  if (!policy) return next();
  if (!policy.roles.includes(role)) {
    return fail(res, 403, "You do not have permission for this action", "FORBIDDEN");
  }
  return next();
});

app.use("/api/orders", ordersRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/masters", mastersRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/vendors", vendorsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/mrp", mrpRoutes);
app.use("/api/sync", syncRoutes);

app.use((error, _req, res, _next) => {
  logError("request.error", error, {
    method: _req?.method,
    path: _req?.path,
    durationMs: _req?.requestStartedAt ? Date.now() - _req.requestStartedAt : null,
  });
  if (error instanceof ApiError) {
    return fail(res, error.status, error.message, error.code, error.details);
  }
  if (error?.name === "ZodError") {
    return fail(res, 400, "Invalid request payload", "VALIDATION_ERROR", error.flatten?.() ?? null);
  }
  return fail(res, 500, "Internal server error", "INTERNAL_SERVER_ERROR");
});

app.listen(port, () => {
  logInfo("server.started", { port, origin: env.APP_ORIGIN, env: env.NODE_ENV });
});
