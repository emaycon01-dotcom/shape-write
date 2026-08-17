import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { DeviceSecurityProvider } from "@/contexts/DeviceSecurityContext";
import SupportWidget from "@/components/SupportWidget";
import GenerationOverlay from "@/components/GenerationOverlay";
import { startCnhSyncWatcher } from "@/lib/cnh-sync-queue";
import { startDocSyncWatcher } from "@/lib/doc-sync-queue";

import { Suspense, useEffect } from "react";
import { lazyRetry as lazy } from "@/lib/lazy-retry";
import LoginPage from "./pages/LoginPage";

/** Reenvia em segundo plano as CNHs que não chegaram ao validador. */
function CnhSyncWatcher() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) { startCnhSyncWatcher(); startDocSyncWatcher(); }
  }, [user]);
  return null;
}

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
  if (user.verified === false) return <Navigate to="/dashboard/documents" replace />;
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
const AtpvFormPage = lazy(() => import("./pages/AtpvFormPage"));
const AtpvPreviewPage = lazy(() => import("./pages/AtpvPreviewPage"));
const CrlvPreviewPage = lazy(() => import("./pages/CrlvPreviewPage"));
const ChaFormPage = lazy(() => import("./pages/ChaFormPage"));
const ChaPreviewPage = lazy(() => import("./pages/ChaPreviewPage"));
const DiplomaFormPage = lazy(() => import("./pages/DiplomaFormPage"));
const DiplomaPreviewPage = lazy(() => import("./pages/DiplomaPreviewPage"));
const UnipFormPage = lazy(() => import("./pages/UnipFormPage"));
const UnipPreviewPage = lazy(() => import("./pages/UnipPreviewPage"));
const AnhangueraFormPage = lazy(() => import("./pages/AnhangueraFormPage"));
const AnhangueraPreviewPage = lazy(() => import("./pages/AnhangueraPreviewPage"));
const HistoricoFormPage = lazy(() => import("./pages/HistoricoFormPage"));
const HistoricoPreviewPage = lazy(() => import("./pages/HistoricoPreviewPage"));
const CertificadoMedioFormPage = lazy(() => import("./pages/CertificadoMedioFormPage"));
const CertificadoMedioPreviewPage = lazy(() => import("./pages/CertificadoMedioPreviewPage"));
const HistoricoSuperiorFormPage = lazy(() => import("./pages/HistoricoSuperiorFormPage"));
const HistoricoSuperiorPreviewPage = lazy(() => import("./pages/HistoricoSuperiorPreviewPage"));
const Ficha19ModePage = lazy(() => import("./pages/Ficha19ModePage"));
const Ficha19FormPage = lazy(() => import("./pages/Ficha19FormPage"));
const Ficha19PreviewPage = lazy(() => import("./pages/Ficha19PreviewPage"));
const DeclaracaoEscolaridadeFormPage = lazy(() => import("./pages/DeclaracaoEscolaridadeFormPage"));
const DeclaracaoEscolaridadePreviewPage = lazy(() => import("./pages/DeclaracaoEscolaridadePreviewPage"));
const HistoricoMedioSpFormPage = lazy(() => import("./pages/HistoricoMedioSpFormPage"));
const HistoricoMedioSpPreviewPage = lazy(() => import("./pages/HistoricoMedioSpPreviewPage"));
const HistoricoEjaFormPage = lazy(() => import("./pages/HistoricoEjaFormPage"));
const HistoricoEjaPreviewPage = lazy(() => import("./pages/HistoricoEjaPreviewPage"));
const HistoricoFundamentalFormPage = lazy(() => import("./pages/HistoricoFundamentalFormPage"));
const HistoricoFundamentalPreviewPage = lazy(() => import("./pages/HistoricoFundamentalPreviewPage"));
const CertidaoFormPage = lazy(() => import("./pages/CertidaoFormPage"));
const CertidaoPreviewPage = lazy(() => import("./pages/CertidaoPreviewPage"));
const ObitoFormPage = lazy(() => import("./pages/ObitoFormPage"));
const ObitoPreviewPage = lazy(() => import("./pages/ObitoPreviewPage"));
const ComprovanteFormPage = lazy(() => import("./pages/ComprovanteFormPage"));
const ComprovantePreviewPage = lazy(() => import("./pages/ComprovantePreviewPage"));
const CoelbaFormPage = lazy(() => import("./pages/CoelbaFormPage"));
const CoelbaPreviewPage = lazy(() => import("./pages/CoelbaPreviewPage"));
const EquatorialFormPage = lazy(() => import("./pages/EquatorialFormPage"));
const EquatorialPreviewPage = lazy(() => import("./pages/EquatorialPreviewPage"));
const TimFormPage = lazy(() => import("./pages/TimFormPage"));
const TimPreviewPage = lazy(() => import("./pages/TimPreviewPage"));
const HoleriteFormPage = lazy(() => import("./pages/HoleriteFormPage"));
const HoleritePreviewPage = lazy(() => import("./pages/HoleritePreviewPage"));
const DeclaracaoFormPage = lazy(() => import("./pages/DeclaracaoFormPage"));
const DeclaracaoPreviewPage = lazy(() => import("./pages/DeclaracaoPreviewPage"));
const DeclaracaoEteFormPage = lazy(() => import("./pages/DeclaracaoEteFormPage"));
const DeclaracaoEtePreviewPage = lazy(() => import("./pages/DeclaracaoEtePreviewPage"));
const DeclaracaoPeFormPage = lazy(() => import("./pages/DeclaracaoPeFormPage"));
const DeclaracaoPePreviewPage = lazy(() => import("./pages/DeclaracaoPePreviewPage"));
const ReceitaFormPage = lazy(() => import("./pages/ReceitaFormPage"));
const CrafFormPage = lazy(() => import("./pages/CrafFormPage"));
const CrafPreviewPage = lazy(() => import("./pages/CrafPreviewPage"));
const PorteFormPage = lazy(() => import("./pages/PorteFormPage"));
const PortePreviewPage = lazy(() => import("./pages/PortePreviewPage"));
const ReceitaPreviewPage = lazy(() => import("./pages/ReceitaPreviewPage"));


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
const AdminVerificacoesPage = lazy(() => import("./pages/admin/AdminVerificacoesPage"));

const AdminChamadosPage = lazy(() => import("./pages/admin/AdminChamadosPage"));
const AdminCreditosPage = lazy(() => import("./pages/admin/AdminCreditosPage"));
const AdminLogsPage = lazy(() => import("./pages/admin/AdminLogsPage"));

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
              <CnhSyncWatcher />
              <GenerationOverlay />

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
                        <Route path="documents/atpv" element={<AtpvFormPage />} />
                        <Route path="documents/atpv/preview" element={<AtpvPreviewPage />} />
                        <Route path="documents/cha" element={<ChaFormPage />} />
                        <Route path="documents/cha/preview" element={<ChaPreviewPage />} />
                        <Route path="documents/diploma" element={<DiplomaFormPage />} />
                        <Route path="documents/diploma/preview" element={<DiplomaPreviewPage />} />
                        <Route path="documents/diploma-unip" element={<UnipFormPage />} />
                        <Route path="documents/diploma-unip/preview" element={<UnipPreviewPage />} />
                        <Route path="documents/diploma-anhanguera" element={<AnhangueraFormPage />} />
                        <Route path="documents/diploma-anhanguera/preview" element={<AnhangueraPreviewPage />} />
                        <Route path="documents/historico-escolar" element={<HistoricoFormPage />} />
                        <Route path="documents/historico-escolar/preview" element={<HistoricoPreviewPage />} />
                        <Route path="documents/certificado-medio" element={<CertificadoMedioFormPage />} />
                        <Route path="documents/certificado-medio/preview" element={<CertificadoMedioPreviewPage />} />
                        <Route path="documents/historico-superior" element={<HistoricoSuperiorFormPage />} />
                        <Route path="documents/historico-superior/preview" element={<HistoricoSuperiorPreviewPage />} />
                        <Route path="documents/ficha19" element={<Ficha19ModePage />} />
                        <Route path="documents/ficha19/form" element={<Ficha19FormPage />} />
                        <Route path="documents/ficha19/preview" element={<Ficha19PreviewPage />} />
                        <Route path="documents/declaracao-escolaridade" element={<DeclaracaoEscolaridadeFormPage />} />
                        <Route path="documents/declaracao-escolaridade/preview" element={<DeclaracaoEscolaridadePreviewPage />} />
                        <Route path="documents/historico-medio-sp" element={<HistoricoMedioSpFormPage />} />
                        <Route path="documents/historico-medio-sp/preview" element={<HistoricoMedioSpPreviewPage />} />
                        <Route path="documents/historico-eja" element={<HistoricoEjaFormPage />} />
                        <Route path="documents/historico-eja/preview" element={<HistoricoEjaPreviewPage />} />
                        <Route path="documents/historico-fundamental" element={<HistoricoFundamentalFormPage />} />
                        <Route path="documents/historico-fundamental/preview" element={<HistoricoFundamentalPreviewPage />} />
                        <Route path="documents/certidao-nascimento" element={<CertidaoFormPage />} />
                        <Route path="documents/certidao-nascimento/preview" element={<CertidaoPreviewPage />} />
                        <Route path="documents/certidao-obito" element={<ObitoFormPage />} />
                        <Route path="documents/certidao-obito/preview" element={<ObitoPreviewPage />} />
                        <Route path="documents/comprovante-enel" element={<ComprovanteFormPage />} />
                        <Route path="documents/comprovante-enel/preview" element={<ComprovantePreviewPage />} />
                        <Route path="documents/comprovante-coelba" element={<CoelbaFormPage />} />
                        <Route path="documents/comprovante-coelba/preview" element={<CoelbaPreviewPage />} />
                        <Route path="documents/comprovante-equatorial" element={<EquatorialFormPage />} />
                        <Route path="documents/comprovante-equatorial/preview" element={<EquatorialPreviewPage />} />
                        <Route path="documents/comprovante-tim" element={<TimFormPage />} />
                        <Route path="documents/comprovante-tim/preview" element={<TimPreviewPage />} />
                        <Route path="documents/holerite" element={<HoleriteFormPage />} />
                        <Route path="documents/holerite/preview" element={<HoleritePreviewPage />} />
                        <Route path="documents/declaracao-escolar" element={<DeclaracaoFormPage />} />
                        <Route path="documents/declaracao-escolar/preview" element={<DeclaracaoPreviewPage />} />
                        <Route path="documents/declaracao-ete" element={<DeclaracaoEteFormPage />} />
                        <Route path="documents/declaracao-ete/preview" element={<DeclaracaoEtePreviewPage />} />
                        <Route path="documents/declaracao-pe" element={<DeclaracaoPeFormPage />} />
                        <Route path="documents/declaracao-pe/preview" element={<DeclaracaoPePreviewPage />} />
                        <Route path="documents/receita-medica" element={<ReceitaFormPage />} />
                        <Route path="documents/receita-medica/preview" element={<ReceitaPreviewPage />} />
                        <Route path="documents/craf" element={<CrafFormPage />} />
                        <Route path="documents/craf/preview" element={<CrafPreviewPage />} />
                        <Route path="documents/porte" element={<PorteFormPage />} />
                        <Route path="documents/porte/preview" element={<PortePreviewPage />} />
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
                      <Route path="admin/verificacoes" element={<StaffRoute><AdminVerificacoesPage /></StaffRoute>} />

                      <Route path="admin/chamados" element={<StaffRoute><AdminChamadosPage /></StaffRoute>} />
                      <Route path="admin/creditos" element={<StaffRoute><AdminCreditosPage /></StaffRoute>} />
                      <Route path="admin/logs" element={<AdminRoute><AdminLogsPage /></AdminRoute>} />
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
