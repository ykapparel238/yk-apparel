import { describe, expect, it } from "vitest";
import { validateReleaseEnv } from "../../scripts/verify-release.mjs";

describe("verify release env", () => {
  it("accepts complete release env", () => {
    expect(() =>
      validateReleaseEnv({
        APP_URL: "http://localhost:8080",
        SMOKE_EMAIL: "rohit@knitcraft.in",
        SMOKE_PASSWORD: "demo1234",
      }),
    ).not.toThrow();
  });

  it("rejects missing release env", () => {
    expect(() =>
      validateReleaseEnv({
        APP_URL: "http://localhost:8080",
        SMOKE_EMAIL: "",
        SMOKE_PASSWORD: "demo1234",
      }),
    ).toThrow("Missing required release env");
  });
});
