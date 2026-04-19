import { describe, expect, it } from "vitest";
import {
  buildDefaultColorAllocations,
  buildDefaultSizeAllocations,
  normaliseOrderInput,
  validateAllocationTotal,
} from "../../server/routes/orders.mjs";

describe("order rules", () => {
  it("normalises PO and season codes", () => {
    const result = normaliseOrderInput({
      poNumber: " po-42 ",
      seasonCode: " aw25 ",
      notes: "  urgent  ",
    });

    expect(result.poNumber).toBe("PO-42");
    expect(result.seasonCode).toBe("AW25");
    expect(result.notes).toBe("urgent");
  });

  it("builds size and color defaults totalling 100", () => {
    const sizes = buildDefaultSizeAllocations([{ label: "S" }, { label: "M" }, { label: "L" }]);
    const colors = buildDefaultColorAllocations([{ name: "Black", hexCode: "#111" }, { name: "Grey", hexCode: "#ccc" }]);

    expect(sizes.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
    expect(colors.reduce((sum, item) => sum + item.percent, 0)).toBe(100);
  });

  it("rejects allocation groups that do not total 100", () => {
    expect(() => validateAllocationTotal([{ sizeLabel: "S", percent: 40 }], "Size allocation")).toThrow(
      "Size allocation must total 100%",
    );
  });
});
