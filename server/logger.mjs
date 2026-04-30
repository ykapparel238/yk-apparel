function timestamp() {
  return new Date().toISOString();
}

export function logInfo(message, meta = {}) {
  console.info(JSON.stringify({ level: "info", ts: timestamp(), message, ...meta }));
}

export function logError(message, error, meta = {}) {
  console.error(JSON.stringify({
    level: "error",
    ts: timestamp(),
    message,
    ...meta,
    error: {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    },
  }));
}

export function requestLogger(req, _res, next) {
  req.requestStartedAt = Date.now();
  logInfo("request.start", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  return next();
}
