import { createContext, useContext, useState, ReactNode } from "react";
import { Role } from "@/lib/mockData";

interface RoleCtx {
  role: Role;
  setRole: (r: Role) => void;
  user: { name: string; email: string };
}

const Ctx = createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("Admin");
  return (
    <Ctx.Provider
      value={{
        role,
        setRole,
        user: { name: "Rohit Mehra", email: "rohit@knitcraft.in" },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRole must be inside RoleProvider");
  return ctx;
}
