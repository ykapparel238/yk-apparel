import {
  enqueueDesktopMutation,
  isDesktopRuntime,
  queryDesktopSnapshot,
  seedDesktopSnapshots,
} from "@/lib/desktopBridge";

export const desktopResources = {
  ordersList: "orders.list",
  ordersOptions: "orders.options",
  orderDetails: "orders.details",
  planningBoard: "planning.board",
  inventory: "inventory.data",
  procurementRequests: "inventory.procurementRequests",
  qa: "qa.data",
  dispatch: "dispatch.data",
} as const;

export async function readDesktopOrRemote<T>(
  resource: string,
  remote: () => Promise<T>,
  seed?: (payload: T) => Record<string, unknown>,
  params?: Record<string, unknown>,
) {
  if (!isDesktopRuntime()) {
    return remote();
  }

  const cached = await queryDesktopSnapshot<T>(resource, params);
  if (cached) {
    return cached;
  }

  const payload = await remote();
  if (seed) {
    await seedDesktopSnapshots(seed(payload));
  }
  return payload;
}

export async function mutateDesktopOrRemote<T>(
  config: {
    entityType: string;
    entityId: string;
    operationType: string;
    payload: unknown;
    baseVersion?: string | null;
  },
  remote: () => Promise<T>,
) {
  if (!isDesktopRuntime()) {
    return remote();
  }

  return enqueueDesktopMutation<T>(config);
}

export async function readDesktopSnapshot<T>(resource: string, params?: Record<string, unknown>) {
  if (!isDesktopRuntime()) return null;
  return queryDesktopSnapshot<T>(resource, params);
}
