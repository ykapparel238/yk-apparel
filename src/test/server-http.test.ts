import { describe, expect, it, vi } from "vitest";
import { fail, requireRoles } from "../../server/http.mjs";

describe("server/http", () => {
  it("fail returns standardized error payload", () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json };

    fail(res as never, 400, "Invalid request", "VALIDATION_ERROR", { field: "email" });

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Invalid request",
      code: "VALIDATION_ERROR",
      details: { field: "email" },
    });
  });

  it("requireRoles blocks unauthorized roles", () => {
    const middleware = requireRoles("ADMIN");
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json };
    const next = vi.fn();

    middleware({ sessionUser: { role: "MERCHANDISER" } } as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});
