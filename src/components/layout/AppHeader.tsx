import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/context/RoleContext";
import { ROLES, Role } from "@/lib/mockData";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  const { role, setRole, user } = useRole();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 backdrop-blur px-4">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="hidden md:flex items-center relative w-80">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search PO, style, vendor, SKU…"
          className="pl-8 h-9 bg-muted/50 border-border text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Live • Shift A
        </div>

        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-muted">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-destructive text-[9px]">
            6
          </Badge>
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
              RM
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block leading-tight">
            <div className="text-xs font-semibold">{user.name}</div>
            <div className="text-[10px] text-muted-foreground">{role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
