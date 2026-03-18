import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import RouteGuard from "@/components/RouteGuard";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProjects from "@/pages/admin/AdminProjects";
import AdminProjectDetail from "@/pages/admin/AdminProjectDetail";
import AdminOperations from "@/pages/admin/AdminOperations";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminReports from "@/pages/admin/AdminReports";
import DesignerDashboard from "@/pages/designer/DesignerDashboard";
import DesignerProjectDetail from "@/pages/designer/DesignerProjectDetail";
import OpsDashboard from "@/pages/operations/OpsDashboard";
import OpsProjectDetail from "@/pages/operations/OpsProjectDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Admin routes */}
            <Route element={<RouteGuard allowedRoles={['ADMIN']} />}>
              <Route element={<AppLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/projects" element={<AdminProjects />} />
                <Route path="/admin/projects/:id" element={<AdminProjectDetail />} />
                <Route path="/admin/operations" element={<AdminOperations />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
              </Route>
            </Route>

            {/* Designer routes */}
            <Route element={<RouteGuard allowedRoles={['DESIGNER']} />}>
              <Route element={<AppLayout />}>
                <Route path="/designer/dashboard" element={<DesignerDashboard />} />
                <Route path="/designer/projects/:id" element={<DesignerProjectDetail />} />
              </Route>
            </Route>

            {/* Operations routes */}
            <Route element={<RouteGuard allowedRoles={['OPERATIONS']} />}>
              <Route element={<AppLayout />}>
                <Route path="/operations/dashboard" element={<OpsDashboard />} />
                <Route path="/operations/projects/:id" element={<OpsProjectDetail />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
