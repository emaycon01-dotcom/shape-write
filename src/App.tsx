import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { DeviceSecurityProvider } from "@/contexts/DeviceSecurityContext";
import SupportWidget from "@/components/SupportWidget";
import { lazy, Suspense } from "react";
import LoginPage from "./pages/LoginPage";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Admins e gerentes: chamados e aprovação de contas. */
function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || (user.role !== "admin" && user.role !== "gerente")) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Somente contas verificadas pelo staff podem abrir os módulos de documentos. */
function VerifiedGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.verified) return <Navigate to="/dashboard/documents" replace />;
  return <Outlet />;
}



const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const CnhFormPage = lazy(() => import("./pages/CnhFormPage"));
const CnhPreviewPage = lazy(() => import("./pages/CnhPreviewPage"));
const RgFormPage = lazy(() => import("./pages/RgFormPage"));
const RgPreviewPage = lazy(() => import("./pages/RgPreviewPage"));
const AtestadoFormPage = lazy(() => import("./pages/AtestadoFormPage"));
const AtestadoPreviewPage = lazy(() => import("./pages/AtestadoPreviewPage"));
const HapvidaFormPage = lazy(() => import("./pages/HapvidaFormPage"));
const HapvidaPreviewPage = lazy(() => import("./pages/HapvidaPreviewPage"));
const UnimedFormPage = lazy(() => import("./pages/UnimedFormPage"));
const UnimedPreviewPage = lazy(() => import("./pages/UnimedPreviewPage"));
const CrlvFormPage = lazy(() => import("./pages/CrlvFormPage"));
const CrlvPreviewPage = lazy(() => import("./pages/CrlvPreviewPage"));
const ChaFormPage = lazy(() => import("./pages/ChaFormPage"));
const ChaPreviewPage = lazy(() => import("./pages/ChaPreviewPage"));
const DiplomaFormPage = lazy(() => import("./pages/DiplomaFormPage"));
const DiplomaPreviewPage = lazy(() => import("./pages/DiplomaPreviewPage"));


const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const RecarregarPage = lazy(() => import("./pages/RecarregarPage"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const TemplateAlignPage = lazy(() => import("./pages/TemplateAlignPage"));
const SignatureGeneratorPage = lazy(() => import("./pages/SignatureGeneratorPage"));
const AplicativosPage = lazy(() => import("./pages/AplicativosPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));
const ConsultaCnhPage = lazy(() => import("./pages/ConsultaCnhPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages
const AdminPanelPage = lazy(() => import("./pages/admin/AdminPanelPage"));
const AdminAprovacoesPage = lazy(() => import("./pages/admin/AdminAprovacoesPage"));
const AdminChamadosPage = lazy(() => import("./pages/admin/AdminChamadosPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DeviceSecurityProvider>
        <AuthProvider>
            <DocumentProvider>
              <Toaster />
              <Sonner />
              <SupportWidget />
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
                      <Route element={<VerifiedGate />}>

                        <Route path="documents/cnh" element={<CnhFormPage />} />
                        <Route path="documents/cnh/preview" element={<CnhPreviewPage />} />
                        <Route path="documents/rg" element={<RgFormPage />} />
                        <Route path="documents/rg/preview" element={<RgPreviewPage />} />
                        <Route path="documents/atestado" element={<AtestadoFormPage />} />
                        <Route path="documents/atestado/preview" element={<AtestadoPreviewPage />} />
                        <Route path="documents/hapvida" element={<HapvidaFormPage />} />
                        <Route path="documents/hapvida/preview" element={<HapvidaPreviewPage />} />
                        <Route path="documents/unimed" element={<UnimedFormPage />} />
                        <Route path="documents/unimed/preview" element={<UnimedPreviewPage />} />
                        <Route path="documents/crlv" element={<CrlvFormPage />} />
                        <Route path="documents/crlv/preview" element={<CrlvPreviewPage />} />
                        <Route path="documents/cha" element={<ChaFormPage />} />
                        <Route path="documents/cha/preview" element={<ChaPreviewPage />} />
                        <Route path="documents/diploma" element={<DiplomaFormPage />} />
                        <Route path="documents/diploma/preview" element={<DiplomaPreviewPage />} />
                        <Route path="history" element={<HistoryPage />} />
                      </Route>

                      <Route path="recarregar" element={<RecarregarPage />} />
                      <Route path="planos" element={<PlanosPage />} />

                      <Route path="template-align" element={<TemplateAlignPage />} />
                      <Route path="ferramentas/assinaturas" element={<SignatureGeneratorPage />} />

                      <Route path="aplicativos" element={<AplicativosPage />} />
                      {/* Admin — guarded by AdminRoute */}
                      <Route path="admin" element={<AdminRoute><AdminPanelPage /></AdminRoute>} />
                      <Route path="admin/aprovacoes" element={<StaffRoute><AdminAprovacoesPage /></StaffRoute>} />
                      <Route path="admin/chamados" element={<StaffRoute><AdminChamadosPage /></StaffRoute>} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </DocumentProvider>
        </AuthProvider>
      </DeviceSecurityProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
