import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

describe("api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed json for successful requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      }),
    );

    await expect(api<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });
  });

  it("throws ApiError with code and details for failed requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ message: "Conflict", code: "CONFLICT", details: { field: "poNumber" } }),
      }),
    );

    await expect(api("/api/test")).rejects.toEqual(
      expect.objectContaining({
        name: "ApiError",
        status: 409,
        code: "CONFLICT",
        details: { field: "poNumber" },
      }),
    );
  });
});
