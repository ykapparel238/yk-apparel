export class ApiError extends Error {
  constructor(status, message, code = "REQUEST_FAILED", details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok(res, payload, status = 200) {
  return res.status(status).json(payload);
}

export function fail(res, status, message, code = "REQUEST_FAILED", details = null) {
  return res.status(status).json({ message, code, details });
}

export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    const userRole = req.sessionUser?.role;
    if (!userRole) {
      return fail(res, 401, "Authentication required", "AUTH_REQUIRED");
    }
    if (!roles.includes(userRole)) {
      return fail(res, 403, "You do not have permission for this action", "FORBIDDEN");
    }
    return next();
  };
}
