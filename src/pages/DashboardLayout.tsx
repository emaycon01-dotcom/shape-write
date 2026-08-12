import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppFooter from "@/components/AppFooter";
import SidebarBackdrop from "@/components/SidebarBackdrop";

import RouteErrorBoundary from "@/components/RouteErrorBoundary";

import { supabase } from "@/integrations/supabase/client";
import { syncAlignmentsFromDb } from "@/lib/align-sync";
import { cancelCurrentGeneration } from "@/lib/browser-pdf";

export default function DashboardLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  // Mantém as coordenadas oficiais (salvas no alinhamento) sincronizadas
  useEffect(() => {
    if (isAuthenticated) void syncAlignmentsFromDb();
  }, [isAuthenticated]);

  // Cancela geração em andamento quando o usuário sai da área de documentos.
  // Evita processamento pesado em background após navegação.
  useEffect(() => {
    const insideGenerationFlow = /\/(form|preview|align)(\/.*)?$/.test(location.pathname);
    if (!insideGenerationFlow) cancelCurrentGeneration();
  }, [location.pathname]);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarBackdrop />
        <div className="flex-1 flex flex-col min-w-0">

          <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            {!isHome && (
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/60"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
            )}
          </header>
          <main className="flex-1 w-full p-4 sm:p-6 overflow-auto">
            <RouteErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </main>

          <AppFooter />
        </div>
      </div>
    </SidebarProvider>
  );
}

