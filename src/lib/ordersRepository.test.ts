import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrderFromRepository,
  fetchOrderDetailFromRepository,
  fetchOrderOptionsFromRepository,
  fetchOrdersFromRepository,
  readOrdersOfflineSnapshot,
  updateOrderFromRepository,
} from "./ordersRepository";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

describe("ordersRepository", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caches orders and falls back to local data when offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            items: [
              {
                id: "ord-1",
                poNumber: "PO-001",
                brandId: "brand-1",
                brand: "Acme",
                styleId: "style-1",
                style: "ST-1",
                styleName: "Cable Crew",
                season: "AW24",
                qty: 1000,
                delivered: 0,
                due: "2026-05-10",
                status: "CREATED",
                priority: "HIGH",
                progress: 0,
              },
            ],
          }),
        })
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );

    await expect(fetchOrdersFromRepository({})).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "ord-1" })],
      }),
    );

    await expect(fetchOrdersFromRepository({ q: "PO-001" })).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "ord-1" })],
      }),
    );
  });

  it("falls back to cached order options when offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            brands: [{ id: "brand-1", name: "Acme", code: "AC" }],
            styles: [{ id: "style-1", name: "Cable Crew", code: "ST-1", brandId: "brand-1" }],
          }),
        })
        .mockRejectedValueOnce(new TypeError("Failed to fetch")),
    );

    await fetchOrderOptionsFromRepository();

    await expect(fetchOrderOptionsFromRepository()).resolves.toEqual({
      brands: [{ id: "brand-1", name: "Acme", code: "AC" }],
      styles: [{ id: "style-1", name: "Cable Crew", code: "ST-1", brandId: "brand-1" }],
    });
  });

  it("queues offline order creates and stores a local detail snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            brands: [{ id: "brand-1", name: "Acme", code: "AC" }],
            styles: [{
              id: "style-1",
              name: "Cable Crew",
              code: "ST-1",
              brandId: "brand-1",
              colors: [{ name: "Navy", hexCode: "#001f3f" }],
              sizes: ["M"],
            }],
          }),
        })
        .mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await fetchOrderOptionsFromRepository();

    const result = await createOrderFromRepository({
      brandId: "brand-1",
      styleId: "style-1",
      poNumber: "PO-OFF-1",
      seasonCode: "AW24",
      quantity: 1200,
      dueDate: "2026-05-12",
      priority: "HIGH",
      notes: "offline create",
      sizeAllocations: [{ sizeLabel: "M", percent: 100 }],
      colorAllocations: [{ colorName: "Navy", hexCode: "#001f3f", percent: 100 }],
    });

    expect(result.item.id).toContain("local-order-");

    const snapshot = readOrdersOfflineSnapshot();
    expect(snapshot.pendingMutations).toHaveLength(1);
    expect(snapshot.pendingMutations[0]).toEqual(
      expect.objectContaining({
        type: "create",
        entityId: result.item.id,
      }),
    );

    await expect(fetchOrderDetailFromRepository(result.item.id)).resolves.toEqual(
      expect.objectContaining({
        item: expect.objectContaining({ poNumber: "PO-OFF-1" }),
      }),
    );
  });

  it("queues offline updates against cached items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            items: [
              {
                id: "ord-1",
                poNumber: "PO-001",
                brandId: "brand-1",
                brand: "Acme",
                styleId: "style-1",
                style: "ST-1",
                styleName: "Cable Crew",
                season: "AW24",
                qty: 1000,
                delivered: 100,
                due: "2026-05-10",
                status: "CREATED",
                priority: "HIGH",
                progress: 10,
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            brands: [{ id: "brand-1", name: "Acme", code: "AC" }],
            styles: [{ id: "style-1", name: "Cable Crew", code: "ST-1", brandId: "brand-1" }],
          }),
        })
        .mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await fetchOrdersFromRepository({});
    await fetchOrderOptionsFromRepository();

    const result = await updateOrderFromRepository("ord-1", {
      brandId: "brand-1",
      styleId: "style-1",
      poNumber: "PO-001-REV-A",
      seasonCode: "AW24",
      quantity: 1100,
      dueDate: "2026-05-14",
      priority: "CRITICAL",
      notes: "offline update",
      sizeAllocations: [{ sizeLabel: "M", percent: 100 }],
      colorAllocations: [{ colorName: "Navy", percent: 100 }],
    });

    expect(result.item.poNumber).toBe("PO-001-REV-A");
    expect(readOrdersOfflineSnapshot().pendingMutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "update",
          entityId: "ord-1",
        }),
      ]),
    );
  });
});
