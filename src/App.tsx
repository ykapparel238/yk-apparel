import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DesktopSyncProvider } from "@/context/DesktopSyncContext";
import { RoleProvider } from "@/context/RoleContext";
import { useRole } from "@/context/RoleContext";
import AppLayout from "@/components/layout/AppLayout";
import { WorkflowChangeRequestDialog } from "@/components/WorkflowChangeRequestDialog";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Planning = lazy(() => import("./pages/Planning"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Production = lazy(() => import("./pages/Production"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const Inventory = lazy(() => import("./pages/Inventory"));
const QA = lazy(() => import("./pages/QA"));
const Dispatch = lazy(() => import("./pages/Dispatch"));
const Masters = lazy(() => import("./pages/Masters"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isReady } = useRole();
  const location = useLocation();

  if (!isReady) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isReady } = useRole();

  if (!isReady) return null;
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const PageFallback = () => (
  <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <WorkflowChangeRequestDialog />
      <DesktopSyncProvider>
        <RoleProvider>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/" element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Shell><Orders /></Shell></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><Shell><OrderDetail /></Shell></ProtectedRoute>} />
                <Route path="/planning" element={<ProtectedRoute><Shell><Planning /></Shell></ProtectedRoute>} />
                <Route path="/planning/calendar" element={<ProtectedRoute><Shell><CalendarPage /></Shell></ProtectedRoute>} />
                <Route path="/production" element={<ProtectedRoute><Shell><Production /></Shell></ProtectedRoute>} />
                <Route path="/vendors" element={<ProtectedRoute><Shell><Vendors /></Shell></ProtectedRoute>} />
                <Route path="/vendors/:id" element={<ProtectedRoute><Shell><VendorDetail /></Shell></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Shell><Inventory /></Shell></ProtectedRoute>} />
                <Route path="/qa" element={<ProtectedRoute><Shell><QA /></Shell></ProtectedRoute>} />
                <Route path="/dispatch" element={<ProtectedRoute><Shell><Dispatch /></Shell></ProtectedRoute>} />
                <Route path="/masters" element={<ProtectedRoute><Shell><Masters /></Shell></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Shell><Reports /></Shell></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Shell><Settings /></Shell></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </RoleProvider>
      </DesktopSyncProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
