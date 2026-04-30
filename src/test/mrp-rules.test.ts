import { describe, expect, it } from "vitest";
import { buildMrpItems } from "../../server/routes/mrp.mjs";

describe("mrp rules", () => {
  it("calculates shortage from demand and free stock", () => {
    const items = buildMrpItems(
      [
        { styleId: "style-1", materialId: "mat-1", quantityPerPiece: "0.5" },
      ] as never,
      [
        { id: "mat-1", sku: "Y001", name: "Cotton Yarn", stockQty: "100", allocatedQty: "40", supplier: { name: "Vardhman" } },
      ] as never,
      [
        { styleId: "style-1", quantity: 200, deliveredQty: 50 },
      ] as never,
    );

    expect(items).toEqual([
      {
        materialId: "mat-1",
        sku: "Y001",
        material: "Cotton Yarn",
        supplier: "Vardhman",
        required: 75,
        free: 60,
        shortage: 15,
      },
    ]);
  });

  it("omits rows with no requirement and no shortage", () => {
    const items = buildMrpItems(
      [{ styleId: "style-1", materialId: "mat-1", quantityPerPiece: "0.2" }] as never,
      [{ id: "mat-1", sku: "Y001", name: "Cotton Yarn", stockQty: "100", allocatedQty: "0", supplier: null }] as never,
      [] as never,
    );

    expect(items).toEqual([]);
  });
});
