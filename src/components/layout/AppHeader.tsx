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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRole } from "@/context/RoleContext";
import { roles, type Role } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DesktopSyncPanel } from "./DesktopSyncPanel";
import { useDesktopSync } from "@/context/DesktopSyncContext";
import { fetchGlobalSearch, fetchNotifications } from "@/lib/services";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router-dom";

export function AppHeader() {
  const { role, setRole, user } = useRole();
  const { status } = useDesktopSync();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q.trim());
  const searchQuery = useQuery({
    queryKey: ["global-search", deferredQ],
    queryFn: () => fetchGlobalSearch(deferredQ),
    enabled: deferredQ.length >= 2,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
  });
  const initials = user
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "KC";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 backdrop-blur px-4">
      <SidebarTrigger className="text-muted-foreground" />
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <div className="hidden md:flex items-center relative w-80">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search PO, style, vendor, SKU…"
              className="pl-8 h-9 bg-muted/50 border-border text-sm"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          {deferredQ.length < 2 ? (
            <div className="p-3 text-xs text-muted-foreground">Type at least 2 characters to search.</div>
          ) : searchQuery.isLoading ? (
            <div className="p-3 text-xs text-muted-foreground">Searching...</div>
          ) : searchQuery.isError ? (
            <div className="p-3 text-xs text-destructive">Unable to search right now.</div>
          ) : searchQuery.data?.groups.length ? (
            <div className="max-h-96 overflow-auto space-y-2">
              {searchQuery.data.groups.map((group) => (
                <div key={group.module}>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{group.module}</div>
                  {group.items.map((item) => (
                    <button
                      key={`${group.module}-${item.id}`}
                      type="button"
                      className="w-full rounded-md px-2 py-2 text-left hover:bg-muted"
                      onClick={() => {
                        navigate(item.href);
                        setSearchOpen(false);
                        setQ("");
                      }}
                    >
                      <div className="text-xs font-medium">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground">{item.subtitle}</div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 text-xs text-muted-foreground">No results found.</div>
          )}
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${status.state === "offline" ? "bg-warning" : status.state === "error" || status.failedBundles ? "bg-destructive" : "bg-success"} ${status.state === "syncing" ? "animate-pulse" : ""}`} />
          <span className="text-muted-foreground">
            {status.isDesktop
              ? status.state === "syncing"
                ? `Syncing • ${status.pendingBundles} pending`
                : status.state === "offline"
                  ? `Offline • ${status.pendingBundles} pending`
                  : status.failedBundles || status.conflictCount
                    ? `Needs attention • ${status.failedBundles + status.conflictCount}`
                    : "Desktop Ready"
              : "Live • Shift A"}
          </span>
        </div>

        <DesktopSyncPanel />

        <Select value={role ?? undefined} onValueChange={(v) => setRole(v as Role)} disabled={!user?.canImpersonate}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <button className="relative h-9 w-9 grid place-items-center rounded-md hover:bg-muted">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {(notificationsQuery.data?.count ?? 0) > 0 ? (
                <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 bg-destructive text-[9px]">
                  {Math.min(notificationsQuery.data?.count ?? 0, 99)}
                </Badge>
              ) : null}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <div className="px-2 py-1.5 text-xs font-semibold">Notifications</div>
            {notificationsQuery.isLoading ? (
              <div className="p-3 text-xs text-muted-foreground">Loading notifications...</div>
            ) : notificationsQuery.isError ? (
              <div className="p-3 text-xs text-destructive">Unable to load notifications.</div>
            ) : notificationsQuery.data?.items.length ? (
              <div className="max-h-96 overflow-auto">
                {notificationsQuery.data.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-md px-2 py-2 text-left hover:bg-muted"
                    onClick={() => navigate(item.href)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{item.title}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{item.module}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{item.severity} / {item.time}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-xs text-muted-foreground">No active notifications.</div>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block leading-tight">
            <div className="text-xs font-semibold">{user?.name ?? "Guest"}</div>
            <div className="text-[10px] text-muted-foreground">{role ?? "No role"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
