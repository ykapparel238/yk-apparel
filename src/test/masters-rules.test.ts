import { describe, expect, it } from "vitest";
import { average, formatVendorStatus } from "../../server/routes/masters.mjs";

describe("masters rules", () => {
  it("formats vendor status labels", () => {
    expect(formatVendorStatus("ACTIVE")).toBe("Active");
    expect(formatVendorStatus("INACTIVE")).toBe("Inactive");
  });

  it("averages numeric scorecards safely", () => {
    expect(average([90, 100, 80])).toBe(90);
    expect(average([])).toBe(0);
  });
});
