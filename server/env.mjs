import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.string().url().default("http://localhost:8080"),
  CORS_ALLOWED_ORIGINS: z.string().optional().default("http://localhost:8080"),
  TRUST_PROXY: z.coerce.boolean().default(false),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  ALLOW_PROD_SEED: z.enum(["true", "false"]).optional().default("false"),
  UPLOAD_STORAGE_DRIVER: z.enum(["local", "s3"]).default(process.env.NODE_ENV === "production" ? "s3" : "local"),
  UPLOAD_LOCAL_DIR: z.string().min(1).default("uploads"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  S3_BUCKET: z.string().optional().default(""),
  S3_REGION: z.string().optional().default(""),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_PUBLIC_BASE_URL: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
});

let cachedEnv = null;

export function getEnv() {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
