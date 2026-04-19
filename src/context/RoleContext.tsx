import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  authenticate,
  clearRoleOverride,
  logoutSession,
  persistRoleOverride,
  readRoleOverride,
  readSession,
  type LoginInput,
  type Role,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

interface RoleCtx {
  role: Role | null;
  setRole: (r: Role) => void;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [user, setUser] = useState<RoleCtx["user"]>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    readSession()
      .then((session) => {
        const nextRole = readRoleOverride() ?? session.user.role;
        setRoleState(nextRole);
        setUser(session.user);
      })
      .catch(() => {
        clearRoleOverride();
        setRoleState(null);
        setUser(null);
      })
      .finally(() => setIsReady(true));
  }, []);

  const setRole = useCallback((nextRole: Role) => {
    setRoleState(nextRole);
    persistRoleOverride(nextRole);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await authenticate(input);
    const nextRole = readRoleOverride() ?? session.user.role;
    setRoleState(nextRole);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => {
    void logoutSession();
    clearRoleOverride();
    setRoleState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      role,
      setRole,
      user,
      isAuthenticated: Boolean(user && role),
      isReady,
      login,
      logout,
    }),
    [isReady, login, logout, role, setRole, user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRole must be inside RoleProvider");
  return ctx;
}
