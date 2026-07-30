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
const EsimDigitalPage = lazy(() => import("./pages/EsimDigitalPage"));
const RecargasPage = lazy(() => import("./pages/RecargasPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const CnhPreviewPage = lazy(() => import("./pages/CnhPreviewPage"));
const TemplateCnhPage = lazy(() => import("./pages/TemplateCnhPage"));
const TemplateAlignPage = lazy(() => import("./pages/TemplateAlignPage"));
const VerifyPage = lazy(() => import("./pages/VerifyPage"));
const RecarregarPage = lazy(() => import("./pages/RecarregarPage"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const RevendedoresPage = lazy(() => import("./pages/RevendedoresPage"));
const SignatureGeneratorPage = lazy(() => import("./pages/SignatureGeneratorPage"));
const RemovedorFundoPage = lazy(() => import("./pages/RemovedorFundoPage"));
const MesclagemRostoPage = lazy(() => import("./pages/MesclagemRostoPage"));
const CnhFisicaEstadoPage = lazy(() => import("./pages/CnhFisicaEstadoPage"));
const CnhFisicaFormPage = lazy(() => import("./pages/CnhFisicaFormPage"));
const CnhFisicaPreviewPage = lazy(() => import("./pages/CnhFisicaPreviewPage"));
const CarteirinhasSelecaoPage = lazy(() => import("./pages/CarteirinhasSelecaoPage"));
const CarteirinhaFormPage = lazy(() => import("./pages/CarteirinhaFormPage"));
const CarteirinhaPreviewPage = lazy(() => import("./pages/CarteirinhaPreviewPage"));
const BombeiroMilitarFormPage = lazy(() => import("./pages/BombeiroMilitarFormPage"));
const OperadorMaquinasFormPage = lazy(() => import("./pages/OperadorMaquinasFormPage"));
const OperadorMaquinasDigitalFormPage = lazy(() => import("./pages/OperadorMaquinasDigitalFormPage"));
const OperadorMaquinasDigitalPreviewPage = lazy(() => import("./pages/OperadorMaquinasDigitalPreviewPage"));
const SegurancaEscolarFormPage = lazy(() => import("./pages/SegurancaEscolarFormPage"));
const CedulaPoliciaFormPage = lazy(() => import("./pages/CedulaPoliciaFormPage"));
const CedulaPoliciaPreviewPage = lazy(() => import("./pages/CedulaPoliciaPreviewPage"));
const CpfFisicoFormPage = lazy(() => import("./pages/CpfFisicoFormPage"));
const CpfFisicoPreviewPage = lazy(() => import("./pages/CpfFisicoPreviewPage"));
const CertidaoNascimentoFormPage = lazy(() => import("./pages/CertidaoNascimentoFormPage"));
const CertidaoNascimentoPreviewPage = lazy(() => import("./pages/CertidaoNascimentoPreviewPage"));
const ComprovanteResidenciaFormPage = lazy(() => import("./pages/ComprovanteResidenciaFormPage"));
const ComprovanteResidenciaPreviewPage = lazy(() => import("./pages/ComprovanteResidenciaPreviewPage"));
const ExameToxicologicoFormPage = lazy(() => import("./pages/ExameToxicologicoFormPage"));
const ExameToxicologicoPreviewPage = lazy(() => import("./pages/ExameToxicologicoPreviewPage"));
const ChaAmadorFormPage = lazy(() => import("./pages/ChaAmadorFormPage"));
const ChaAmadorPreviewPage = lazy(() => import("./pages/ChaAmadorPreviewPage"));
const CnhNauticaFormPage = lazy(() => import("./pages/CnhNauticaFormPage"));
const CnhNauticaPreviewPage = lazy(() => import("./pages/CnhNauticaPreviewPage"));
const HistoricoEscolarFormPage = lazy(() => import("./pages/HistoricoEscolarFormPage"));
const HistoricoEscolarPreviewPage = lazy(() => import("./pages/HistoricoEscolarPreviewPage"));
const DeclaracaoEscolarFormPage = lazy(() => import("./pages/DeclaracaoEscolarFormPage"));
const DeclaracaoEscolarPreviewPage = lazy(() => import("./pages/DeclaracaoEscolarPreviewPage"));
const CertificadoEscolarFormPage = lazy(() => import("./pages/CertificadoEscolarFormPage"));
const CertificadoEscolarPreviewPage = lazy(() => import("./pages/CertificadoEscolarPreviewPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ConsultaCnhPage = lazy(() => import("./pages/ConsultaCnhPage"));

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
                      <Route path="documents/esim" element={<EsimDigitalPage />} />
                      <Route path="documents/recargas" element={<RecargasPage />} />
                      <Route path="documents/cnh/preview" element={<CnhPreviewPage />} />
                      <Route path="documents/certidao-nascimento" element={<CertidaoNascimentoFormPage />} />
                      <Route path="documents/certidao-nascimento/preview" element={<CertidaoNascimentoPreviewPage />} />
                      <Route path="documents/comprovante-residencia" element={<ComprovanteResidenciaFormPage />} />
                      <Route path="documents/comprovante-residencia/preview" element={<ComprovanteResidenciaPreviewPage />} />
                      <Route path="documents/exame-toxicologico" element={<ExameToxicologicoFormPage />} />
                      <Route path="documents/exame-toxicologico/preview" element={<ExameToxicologicoPreviewPage />} />
                      <Route path="documents/cha-amador" element={<ChaAmadorFormPage />} />
                      <Route path="documents/cha-amador/preview" element={<ChaAmadorPreviewPage />} />
                      <Route path="documents/historico-escolar" element={<HistoricoEscolarFormPage />} />
                      <Route path="documents/historico-escolar/preview" element={<HistoricoEscolarPreviewPage />} />
                      <Route path="documents/declaracao-escolar" element={<DeclaracaoEscolarFormPage />} />
                      <Route path="documents/declaracao-escolar/preview" element={<DeclaracaoEscolarPreviewPage />} />
                      <Route path="documents/certificado-escolar" element={<CertificadoEscolarFormPage />} />
                      <Route path="documents/certificado-escolar/preview" element={<CertificadoEscolarPreviewPage />} />
                      <Route path="history" element={<HistoryPage />} />
                      <Route path="recarregar" element={<RecarregarPage />} />
                      <Route path="planos" element={<PlanosPage />} />
                      <Route path="revendedores" element={<RevendedoresPage />} />
                      <Route path="template-cnh" element={<TemplateCnhPage />} />
                      <Route path="template-align" element={<TemplateAlignPage />} />
                      <Route path="ferramentas/assinatura" element={<SignatureGeneratorPage />} />
                      <Route path="ferramentas/remover-fundo" element={<RemovedorFundoPage />} />
                      <Route path="ferramentas/mesclagem-rosto" element={<MesclagemRostoPage />} />
                      <Route path="cnh-fisica/todos" element={<CnhFisicaFormPage />} />
                      <Route path="cnh-fisica/todos/preview" element={<CnhFisicaPreviewPage />} />
                      <Route path="cnh-fisica/:uf" element={<CnhFisicaEstadoPage />} />
                      <Route path="documentos-fisicos/carteirinhas" element={<CarteirinhasSelecaoPage />} />
                      <Route path="documentos-fisicos/carteirinhas/bombeiro-militar" element={<BombeiroMilitarFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/bombeiro-militar/preview" element={<CarteirinhaPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/operador-maquinas" element={<OperadorMaquinasFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/operador-maquinas/preview" element={<CarteirinhaPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/operador-maquinas-digital" element={<OperadorMaquinasDigitalFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/operador-maquinas-digital/preview" element={<OperadorMaquinasDigitalPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/seguranca-escolar" element={<SegurancaEscolarFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/seguranca-escolar/preview" element={<CarteirinhaPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/cedula-policia-pe" element={<CedulaPoliciaFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/cedula-policia-pe/preview" element={<CedulaPoliciaPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/cpf-fisico" element={<CpfFisicoFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/cpf-fisico/preview" element={<CpfFisicoPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/cnh-nautica" element={<CnhNauticaFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/cnh-nautica/preview" element={<CnhNauticaPreviewPage />} />
                      <Route path="documentos-fisicos/carteirinhas/:tipo" element={<CarteirinhaFormPage />} />
                      <Route path="documentos-fisicos/carteirinhas/:tipo/preview" element={<CarteirinhaPreviewPage />} />
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
