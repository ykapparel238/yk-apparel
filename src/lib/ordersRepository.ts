import { api } from "@/lib/api";
import { withWorkflowChangeRequest } from "@/lib/changeRequests";
import type { OrderDetailPayload, OrderItem, OrderOption } from "@/lib/types";

export type OrdersFilters = {
  q?: string;
  status?: string;
  brandId?: string;
  styleId?: string;
};

export type SaveOrderInput = {
  brandId: string;
  styleId: string;
  poNumber: string;
  seasonCode: string;
  quantity: number;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notes?: string;
  sizeAllocations?: Array<{ sizeLabel: string; percent: number }>;
  colorAllocations?: Array<{ colorName: string; hexCode?: string | null; percent: number }>;
};

type OrdersListPayload = { items: OrderItem[] };
type OrderOptionsPayload = { brands: OrderOption[]; styles: OrderOption[] };

type PendingOrderMutation =
  | { id: string; type: "create"; entityId: string; payload: SaveOrderInput; createdAt: string }
  | { id: string; type: "update"; entityId: string; payload: SaveOrderInput; createdAt: string }
  | { id: string; type: "delete"; entityId: string; createdAt: string };

type OrdersCache = {
  items: OrderItem[];
  details: Record<string, OrderDetailPayload>;
  options: OrderOptionsPayload | null;
  pendingMutations: PendingOrderMutation[];
  updatedAt: string | null;
};

const CACHE_KEY = "ykapparels.offline.orders.cache.v1";

const emptyCache = (): OrdersCache => ({
  items: [],
  details: {},
  options: null,
  pendingMutations: [],
  updatedAt: null,
});

const safeStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
};

function readCache(): OrdersCache {
  const raw = safeStorage.getItem(CACHE_KEY);
  if (!raw) return emptyCache();

  try {
    const parsed = JSON.parse(raw) as Partial<OrdersCache>;
    return {
      items: parsed.items ?? [],
      details: parsed.details ?? {},
      options: parsed.options ?? null,
      pendingMutations: parsed.pendingMutations ?? [],
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return emptyCache();
  }
}

function writeCache(cache: OrdersCache) {
  safeStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function buildOrdersQuery(filters: OrdersFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return `/api/orders${query ? `?${query}` : ""}`;
}

function isOfflineError(error: unknown) {
  return error instanceof TypeError;
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toOrderItem(payload: SaveOrderInput, options: OrderOptionsPayload | null, existing?: OrderItem): OrderItem {
  const brand = options?.brands.find((item) => item.id === payload.brandId);
  const style = options?.styles.find((item) => item.id === payload.styleId);

  return {
    id: existing?.id ?? makeId("local-order"),
    poNumber: payload.poNumber,
    brandId: payload.brandId,
    brand: brand?.name ?? existing?.brand ?? "Unknown brand",
    styleId: payload.styleId,
    style: style?.code ?? existing?.style ?? "Unknown style",
    styleName: style?.name ?? existing?.styleName ?? "Unknown style",
    season: payload.seasonCode,
    qty: payload.quantity,
    delivered: existing?.delivered ?? 0,
    due: payload.dueDate,
    status: existing?.status ?? "CREATED",
    priority: payload.priority,
    progress: existing?.progress ?? 0,
  };
}

function toOrderDetail(item: OrderItem, payload: SaveOrderInput): OrderDetailPayload {
  return {
    item,
    bom: [],
    sizes: (payload.sizeAllocations ?? []).map((entry) => ({
      size: entry.sizeLabel,
      qty: entry.percent,
    })),
    colors: (payload.colorAllocations ?? []).map((entry) => ({
      color: entry.colorName,
      hex: entry.hexCode ?? null,
      qty: entry.percent,
    })),
    challans: [],
  };
}

function upsertItem(items: OrderItem[], nextItem: OrderItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) {
    return [nextItem, ...items];
  }

  const nextItems = [...items];
  nextItems[index] = nextItem;
  return nextItems;
}

function filterItems(items: OrderItem[], filters: OrdersFilters) {
  const q = filters.q?.trim().toLowerCase();

  return items.filter((item) => {
    if (q) {
      const haystack = [
        item.poNumber,
        item.brand,
        item.style,
        item.styleName,
        item.season,
        item.status,
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.status && item.status !== filters.status) return false;
    if (filters.brandId && item.brandId !== filters.brandId) return false;
    if (filters.styleId && item.styleId !== filters.styleId) return false;
    return true;
  });
}

export async function fetchOrdersFromRepository(filters: OrdersFilters) {
  try {
    const response = await api<OrdersListPayload>(buildOrdersQuery(filters));
    const cache = readCache();
    writeCache({
      ...cache,
      items: response.items,
      updatedAt: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    const cache = readCache();
    if (isOfflineError(error) && cache.items.length) {
      return { items: filterItems(cache.items, filters) };
    }
    throw error;
  }
}

export async function fetchOrderOptionsFromRepository() {
  try {
    const response = await api<OrderOptionsPayload>("/api/orders/options");
    const cache = readCache();
    writeCache({
      ...cache,
      options: response,
      updatedAt: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    const cache = readCache();
    if (isOfflineError(error) && cache.options) {
      return cache.options;
    }
    throw error;
  }
}

export async function fetchOrderDetailFromRepository(id: string) {
  try {
    const response = await api<OrderDetailPayload>(`/api/orders/${id}`);
    const cache = readCache();
    writeCache({
      ...cache,
      details: {
        ...cache.details,
        [id]: response,
      },
      items: upsertItem(cache.items, response.item),
      updatedAt: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    const cache = readCache();
    if (isOfflineError(error) && cache.details[id]) {
      return cache.details[id];
    }
    throw error;
  }
}

export async function createOrderFromRepository(payload: SaveOrderInput) {
  try {
    const response = await api<{ item: OrderItem }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const cache = readCache();
    const detail = toOrderDetail(response.item, payload);
    writeCache({
      ...cache,
      items: upsertItem(cache.items, response.item),
      details: {
        ...cache.details,
        [response.item.id]: detail,
      },
      updatedAt: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    if (!isOfflineError(error)) throw error;

    const cache = readCache();
    const item = toOrderItem(payload, cache.options);
    const detail = toOrderDetail(item, payload);
    writeCache({
      ...cache,
      items: upsertItem(cache.items, item),
      details: {
        ...cache.details,
        [item.id]: detail,
      },
      pendingMutations: [
        {
          id: makeId("mutation"),
          type: "create",
          entityId: item.id,
          payload,
          createdAt: new Date().toISOString(),
        },
        ...cache.pendingMutations,
      ],
      updatedAt: new Date().toISOString(),
    });
    return { item };
  }
}

export async function updateOrderFromRepository(id: string, payload: SaveOrderInput) {
  try {
    const response = await withWorkflowChangeRequest(
      () => api<{ item: OrderItem }>(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
      { module: "orders", entityType: "PurchaseOrder", entityId: id, operation: "update" },
      payload,
    );
    const cache = readCache();
    const detail = toOrderDetail(response.item, payload);
    writeCache({
      ...cache,
      items: upsertItem(cache.items, response.item),
      details: {
        ...cache.details,
        [id]: detail,
      },
      updatedAt: new Date().toISOString(),
    });
    return response;
  } catch (error) {
    if (!isOfflineError(error)) throw error;

    const cache = readCache();
    const existing = cache.items.find((item) => item.id === id);
    const item = toOrderItem(payload, cache.options, existing ? { ...existing, id } : { id } as OrderItem);
    const detail = toOrderDetail(item, payload);
    writeCache({
      ...cache,
      items: upsertItem(cache.items, item),
      details: {
        ...cache.details,
        [id]: detail,
      },
      pendingMutations: [
        {
          id: makeId("mutation"),
          type: "update",
          entityId: id,
          payload,
          createdAt: new Date().toISOString(),
        },
        ...cache.pendingMutations,
      ],
      updatedAt: new Date().toISOString(),
    });
    return { item };
  }
}

export async function deleteOrderFromRepository(id: string) {
  try {
    await withWorkflowChangeRequest(
      () => api<void>(`/api/orders/${id}`, { method: "DELETE" }),
      { module: "orders", entityType: "PurchaseOrder", entityId: id, operation: "delete" },
      { id },
    );
    const cache = readCache();
    const nextDetails = { ...cache.details };
    delete nextDetails[id];
    writeCache({
      ...cache,
      items: cache.items.filter((item) => item.id !== id),
      details: nextDetails,
      updatedAt: new Date().toISOString(),
    });
    return;
  } catch (error) {
    if (!isOfflineError(error)) throw error;

    const cache = readCache();
    const nextDetails = { ...cache.details };
    delete nextDetails[id];
    writeCache({
      ...cache,
      items: cache.items.filter((item) => item.id !== id),
      details: nextDetails,
      pendingMutations: [
        {
          id: makeId("mutation"),
          type: "delete",
          entityId: id,
          createdAt: new Date().toISOString(),
        },
        ...cache.pendingMutations,
      ],
      updatedAt: new Date().toISOString(),
    });
    return;
  }
}

export function readOrdersOfflineSnapshot() {
  return readCache();
}
