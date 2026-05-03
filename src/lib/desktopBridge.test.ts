import { describe, expect, it, vi } from "vitest";
import { getApiBaseUrl, getDesktopSyncStatus, isDesktopRuntime } from "./desktopBridge";

describe("desktopBridge", () => {
  it("falls back cleanly in web runtime", async () => {
    vi.stubGlobal("window", {});
    expect(isDesktopRuntime()).toBe(false);
    expect(getApiBaseUrl()).toBe("");
    await expect(getDesktopSyncStatus()).resolves.toMatchObject({
      isDesktop: false,
    });
  });
});
