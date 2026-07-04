import {
  LayoutDashboard,
  ShoppingCart,
  CalendarRange,
  Factory,
  Truck,
  ShieldCheck,
  Package,
  Users2,
  BarChart3,
  ShieldAlert,
  Settings,
  Boxes,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router-dom";
import { fetchOpsToday } from "@/lib/services";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const main = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Today Ops", url: "/ops", icon: ClipboardList },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Production Planning", url: "/planning", icon: CalendarRange },
  { title: "Production Floor", url: "/production", icon: Factory },
  { title: "Quality (QA)", url: "/qa", icon: ShieldCheck },
];

const ops = [
  { title: "Vendors", url: "/vendors", icon: Users2 },
  { title: "Inventory & Stores", url: "/inventory", icon: Boxes },
  { title: "Dispatch", url: "/dispatch", icon: Truck },
  { title: "Master Data", url: "/masters", icon: Package },
];

const insights = [
  { title: "Exceptions", url: "/exceptions", icon: ShieldAlert },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const opsQuery = useQuery({ queryKey: ["ops-today", "sidebar"], queryFn: fetchOpsToday, refetchInterval: 60_000 });
  const todayCount = opsQuery.data?.summary?.critical || opsQuery.data?.summary?.warning || opsQuery.data?.summary?.actionable || 0;

  const renderItem = (item: { title: string; url: string; icon: LucideIcon }) => {
    const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
              active
                ? "bg-primary-soft text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
            {!collapsed && item.url === "/ops" && todayCount > 0 ? (
              <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                {Math.min(todayCount, 99)}
              </span>
            ) : null}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-sm">
          KC
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">KnitCraft MES</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Textile Production
            </span>
          </div>
        )}
      </div>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Operations
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{main.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Supply Chain
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{ops.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Insights
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{insights.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
