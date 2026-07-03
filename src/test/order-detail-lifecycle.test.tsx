import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import OrderDetail from "@/pages/OrderDetail";
import { fetchOrderDetail } from "@/lib/services";

vi.mock("@/lib/services", () => ({
  fetchOrderDetail: vi.fn(),
}));

let container: HTMLDivElement | null = null;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  if (container) {
    container.remove();
    container = null;
  }
  vi.clearAllMocks();
});

async function renderOrderDetail() {
  container = document.createElement("div");
  document.body.appendChild(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const ProductionTarget = () => {
    const location = useLocation();
    const state = location.state as { openProductionForOrderId?: string } | null;
    return <div>Production target {state?.openProductionForOrderId}</div>;
  };

  await act(async () => {
    createRoot(container!).render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/orders/ord-1"]}>
          <Routes>
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/production" element={<ProductionTarget />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("OrderDetail lifecycle command view", () => {
  it("renders lifecycle status and carries guided action route state", async () => {
    vi.mocked(fetchOrderDetail).mockResolvedValue({
      item: {
        id: "ord-1",
        poNumber: "PO-1",
        brandId: "brand-1",
        brand: "Brand A",
        styleId: "style-1",
        style: "ST-1",
        styleName: "Crew Neck",
        season: "AW26",
        qty: 100,
        delivered: 0,
        due: "2026-05-20",
        status: "Planned",
        priority: "High",
        progress: 0,
      },
      bom: [],
      sizes: [{ size: "M", qty: 100 }],
      colors: [{ color: "Navy", hex: "#123456", qty: 100 }],
      challans: [],
      techPack: {
        styleId: "style-1",
        assets: [],
        samples: [],
        measurements: [],
        threadSpecs: [],
        colorways: [],
      },
      lifecycle: {
        steps: [
          {
            key: "readiness",
            label: "Readiness",
            status: "complete",
            summary: "Ready to produce.",
            metrics: { hasTechPack: true, hasBom: true, materialShortageCount: 0 },
            action: { label: "Review masters", route: "/masters", state: { styleId: "style-1" } },
          },
          {
            key: "production",
            label: "Production",
            status: "not_started",
            summary: "No shift actuals recorded yet.",
            metrics: { actualQty: 0, rejectedQty: 0, downtimeMinutes: 0, stages: [] },
            action: { label: "Add actuals", route: "/production", state: { openProductionForOrderId: "ord-1" } },
          },
        ],
        risks: [{ severity: "info", module: "Production", message: "Plan exists, but no production actuals have been recorded yet." }],
        nextAction: { label: "Add actuals", route: "/production", state: { openProductionForOrderId: "ord-1" } },
      },
    });

    await renderOrderDetail();
    await vi.waitFor(() => {
      expect(container!.textContent).toContain("Lifecycle Command");
      expect(container!.textContent).toContain("No shift actuals recorded yet.");
    });

    const button = Array.from(container!.querySelectorAll("button")).find((item) => item.textContent?.includes("Add actuals"));
    expect(button).toBeTruthy();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(container!.textContent).toContain("Production target ord-1");
    });
  });
});
