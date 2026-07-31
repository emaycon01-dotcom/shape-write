import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { DeviceSecurityProvider, useDeviceSecurity } from "@/contexts/DeviceSecurityContext";
import DeviceBannedScreen from "@/components/DeviceBannedScreen";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import { lazy, Suspense, useEffect } from "react";

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
const RgFormPage = lazy(() => import("./pages/RgFormPage"));
const RgPreviewPage = lazy(() => import("./pages/RgPreviewPage"));
const AtestadoFormPage = lazy(() => import("./pages/AtestadoFormPage"));
const AtestadoPreviewPage = lazy(() => import("./pages/AtestadoPreviewPage"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

// Pré-carrega os chunks das telas mais usadas quando o navegador está ocioso,
// deixando a troca de menus praticamente instantânea.
function useIdlePrefetch() {
  useEffect(() => {
    const warm = () => {
      void import("./pages/DashboardLayout");
      void import("./pages/DashboardHome");
      void import("./pages/DocumentsPage");
      void import("./pages/HistoryPage");
      void import("./pages/RecarregarPage");
      void import("./pages/PlanosPage");
      void import("./pages/LoginPage");
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const id = ric ? ric(warm, { timeout: 2500 }) : window.setTimeout(warm, 1200);
    return () => {
      const cic = (window as any).cancelIdleCallback;
      if (ric && cic) cic(id);
      else window.clearTimeout(id);
    };
  }, []);
}

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  useIdlePrefetch();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DeviceSecurityProvider>
        <SecurityGate>
          <AuthProvider>
            <DocumentProvider>
              <Toaster />
              <Sonner />
              <FloatingWhatsApp />
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
                      <Route path="documents/rg" element={<RgFormPage />} />
                      <Route path="documents/rg/preview" element={<RgPreviewPage />} />
                      <Route path="documents/atestado" element={<AtestadoFormPage />} />
                      <Route path="documents/atestado/preview" element={<AtestadoPreviewPage />} />

                      <Route path="documents/crlv" element={<CrlvFormPage />} />
                      <Route path="documents/crlv/preview" element={<CrlvPreviewPage />} />

                      <Route path="documents/cha" element={<ChaFormPage />} />
                      <Route path="documents/cha/preview" element={<ChaPreviewPage />} />

                      <Route path="documents/diploma" element={<DiplomaFormPage />} />
                      <Route path="documents/diploma/preview" element={<DiplomaPreviewPage />} />




                      <Route path="history" element={<HistoryPage />} />
                      <Route path="recarregar" element={<RecarregarPage />} />
                      <Route path="planos" element={<PlanosPage />} />

                      <Route path="template-align" element={<TemplateAlignPage />} />
                      <Route path="ferramentas/assinaturas" element={<SignatureGeneratorPage />} />
                      <Route path="aplicativos" element={<AplicativosPage />} />
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
};

export default App;
