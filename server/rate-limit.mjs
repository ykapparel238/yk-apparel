import { fail } from "./http.mjs";

const buckets = new Map();

function getBucketKey(req) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${req.ip || "unknown"}:${email}`;
}

export function createRateLimiter({ windowMs, max, code = "RATE_LIMITED", message = "Too many requests" }) {
  return (req, res, next) => {
    const key = getBucketKey(req);
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      return fail(res, 429, message, code, {
        retryAfterMs: current.resetAt - now,
      });
    }

    current.count += 1;
    buckets.set(key, current);
    return next();
  };
}
