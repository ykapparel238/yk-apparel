import { describe, expect, it } from "vitest";
import { calculateDailyTarget, calculateDayCount, toUtcDate } from "../../server/routes/planning.mjs";

describe("planning rules", () => {
  it("parses UTC-safe dates", () => {
    expect(toUtcDate("2026-05-01")).toBeInstanceOf(Date);
    expect(toUtcDate("not-a-date")).toBeNull();
  });

  it("calculates inclusive plan windows", () => {
    const start = new Date("2026-05-01T00:00:00.000Z");
    const end = new Date("2026-05-03T00:00:00.000Z");

    expect(calculateDayCount(start, end)).toBe(3);
    expect(calculateDailyTarget(900, start, end)).toBe(300);
  });
});
