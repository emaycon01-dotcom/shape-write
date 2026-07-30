import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { DeviceSecurityProvider, useDeviceSecurity } from "@/contexts/DeviceSecurityContext";
import DeviceBannedScreen from "@/components/DeviceBannedScreen";
import { lazy, Suspense } from "react";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SecurityGate({ children }: { children: React.ReactNode }) {
  const { isBanned, checkingDevice } = useDeviceSecurity();

  if (checkingDevice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isBanned) return <DeviceBannedScreen />;

  return <>{children}</>;
}

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const CnhFormPage = lazy(() => import("./pages/CnhFormPage"));
const CnhPreviewPage = lazy(() => import("./pages/CnhPreviewPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const RecarregarPage = lazy(() => import("./pages/RecarregarPage"));
const TemplateAlignPage = lazy(() => import("./pages/TemplateAlignPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));
const ConsultaCnhPage = lazy(() => import("./pages/ConsultaCnhPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages
const AdminPanelPage = lazy(() => import("./pages/admin/AdminPanelPage"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DeviceSecurityProvider>
        <SecurityGate>
          <AuthProvider>
            <DocumentProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/verify/:id" element={<VerifyPage />} />
                    <Route path="/consulta-cnh" element={<ConsultaCnhPage />} />
                    <Route path="/dashboard" element={<DashboardLayout />}>
                      <Route index element={<DashboardHome />} />
                      <Route path="documents" element={<DocumentsPage />} />
                      <Route path="documents/cnh" element={<CnhFormPage />} />
                      <Route path="documents/cnh/preview" element={<CnhPreviewPage />} />
                      <Route path="history" element={<HistoryPage />} />
                      <Route path="recarregar" element={<RecarregarPage />} />
                      <Route path="template-align" element={<TemplateAlignPage />} />
                      {/* Admin — guarded by AdminRoute */}
                      <Route path="admin" element={<AdminRoute><AdminPanelPage /></AdminRoute>} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </DocumentProvider>
          </AuthProvider>
        </SecurityGate>
      </DeviceSecurityProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
