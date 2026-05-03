import { getApiBaseUrl } from "@/lib/desktopBridge";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(input: string, init?: RequestInit): Promise<T> {
  const normalizedInput = input.startsWith("/api") && getApiBaseUrl()
    ? `${getApiBaseUrl()}${input}`
    : input;

  const response = await fetch(normalizedInput, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.message ?? "Request failed", response.status, data?.code, data?.details);
  }

  return data as T;
}
