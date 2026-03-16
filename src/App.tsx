import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { lazy, Suspense } from "react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
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
const TransferirPage = lazy(() => import("./pages/TransferirPage"));
const RevendedoresPage = lazy(() => import("./pages/RevendedoresPage"));
const MetricasPage = lazy(() => import("./pages/MetricasPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));
const SignatureGeneratorPage = lazy(() => import("./pages/SignatureGeneratorPage"));
const RemovedorFundoPage = lazy(() => import("./pages/RemovedorFundoPage"));
const CnhFisicaEstadoPage = lazy(() => import("./pages/CnhFisicaEstadoPage"));
const CertidaoNascimentoFormPage = lazy(() => import("./pages/CertidaoNascimentoFormPage"));
const CertidaoNascimentoPreviewPage = lazy(() => import("./pages/CertidaoNascimentoPreviewPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <DocumentProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify/:id" element={<VerifyPage />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<DashboardHome />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="documents/cnh" element={<CnhFormPage />} />
                  <Route path="documents/esim" element={<EsimDigitalPage />} />
                  <Route path="documents/recargas" element={<RecargasPage />} />
                  <Route path="documents/cnh/preview" element={<CnhPreviewPage />} />
                  <Route path="documents/certidao-nascimento" element={<CertidaoNascimentoFormPage />} />
                  <Route path="documents/certidao-nascimento/preview" element={<CertidaoNascimentoPreviewPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="recarregar" element={<RecarregarPage />} />
                  <Route path="planos" element={<PlanosPage />} />
                  <Route path="transferir" element={<TransferirPage />} />
                  <Route path="revendedores" element={<RevendedoresPage />} />
                  <Route path="metricas" element={<MetricasPage />} />
                  <Route path="configuracoes" element={<ConfiguracoesPage />} />
                  <Route path="template-cnh" element={<TemplateCnhPage />} />
                  <Route path="template-align" element={<TemplateAlignPage />} />
                  <Route path="ferramentas/assinatura" element={<SignatureGeneratorPage />} />
                  <Route path="cnh-fisica/:uf" element={<CnhFisicaEstadoPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </DocumentProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
