import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/context/RoleContext";
import { useRole } from "@/context/RoleContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Planning from "./pages/Planning";
import CalendarPage from "./pages/Calendar";
import Production from "./pages/Production";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import Inventory from "./pages/Inventory";
import QA from "./pages/QA";
import Dispatch from "./pages/Dispatch";
import Masters from "./pages/Masters";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound.tsx";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
