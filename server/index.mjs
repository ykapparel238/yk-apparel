import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { prisma } from "./db.mjs";
import { getEnv } from "./env.mjs";
import { findSessionUser, getSessionCookieName, serializeUser } from "./auth.mjs";
import { ApiError, fail } from "./http.mjs";
import authRoutes from "./routes/auth.mjs";
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
import vendorsRoutes from "./routes/vendors.mjs";

const app = express();
const env = getEnv();
const port = env.API_PORT;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, environment: env.NODE_ENV });
});

app.get("/api/health/db", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
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

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof ApiError) {
    return fail(res, error.status, error.message, error.code, error.details);
  }
  if (error?.name === "ZodError") {
    return fail(res, 400, "Invalid request payload", "VALIDATION_ERROR", error.flatten?.() ?? null);
  }
  return fail(res, 500, "Internal server error", "INTERNAL_SERVER_ERROR");
});

app.listen(port, () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});
