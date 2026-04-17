import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider } from "@/context/RoleContext";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Planning from "./pages/Planning";
import Production from "./pages/Production";
import Vendors from "./pages/Vendors";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Shell><Dashboard /></Shell>} />
            <Route path="/orders" element={<Shell><Orders /></Shell>} />
            <Route path="/planning" element={<Shell><Planning /></Shell>} />
            <Route path="/production" element={<Shell><Production /></Shell>} />
            <Route path="/vendors" element={<Shell><Vendors /></Shell>} />
            <Route path="/inventory" element={<Shell><Inventory /></Shell>} />
            <Route path="/qa" element={<Shell><QA /></Shell>} />
            <Route path="/dispatch" element={<Shell><Dispatch /></Shell>} />
            <Route path="/masters" element={<Shell><Masters /></Shell>} />
            <Route path="/reports" element={<Shell><Reports /></Shell>} />
            <Route path="/settings" element={<Shell><Settings /></Shell>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
