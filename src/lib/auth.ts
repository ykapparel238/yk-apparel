import { z } from "zod";
import { api } from "@/lib/api";
import type { AuthUser, Role } from "@/lib/types";

export const roles = [
  "Admin",
  "Factory Manager",
  "Production Planner",
  "Merchandiser",
  "QA Manager",
  "Store Manager",
  "Line Supervisor",
  "Vendor Manager",
  "Dispatch Manager",
] as const;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const ROLE_OVERRIDE_KEY = "knitcraft.role.override";

const safeStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

export function readRoleOverride() {
  const raw = safeStorage.getItem(ROLE_OVERRIDE_KEY);
  return raw as Role | null;
}

export function persistRoleOverride(role: Role) {
  safeStorage.setItem(ROLE_OVERRIDE_KEY, role);
}

export function clearRoleOverride() {
  safeStorage.removeItem(ROLE_OVERRIDE_KEY);
}

export async function authenticate(input: LoginInput) {
  return api<{ user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function readSession() {
  return api<{ user: AuthUser }>("/api/auth/session");
}

export async function logoutSession() {
  return api<void>("/api/auth/logout", {
    method: "POST",
  });
}
