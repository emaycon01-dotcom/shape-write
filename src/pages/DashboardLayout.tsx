import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import PinGate from "@/components/PinGate";
import { syncAlignmentsFromDb } from "@/lib/align-sync";

const PIN_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/dashboard" || location.pathname === "/dashboard/";
  const [pinState, setPinState] = useState<"loading" | "needs_setup" | "needs_verify" | "verified">("loading");

  // Mantém as coordenadas oficiais (salvas no alinhamento) sincronizadas
  useEffect(() => {
    if (isAuthenticated) void syncAlignmentsFromDb();
  }, [isAuthenticated]);


  useEffect(() => {
    if (!isAuthenticated || !user) {
      setPinState("loading");
      return;
    }

    const lastVerified = sessionStorage.getItem("pin_verified");
    if (lastVerified && Date.now() - Number(lastVerified) < PIN_SESSION_DURATION) {
      setPinState("verified");
      return;
    }

    // Cache local: evita esperar a edge function para saber se o usuário já tem PIN
    const cacheKey = `pin_has:${user.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached === "1") setPinState("needs_verify");
    else if (cached === "0") setPinState("needs_setup");

    const checkPin = async () => {
      try {
        const { data } = await supabase.functions.invoke("manage-pin", {
          body: { action: "check" },
        });
        const hasPin = !!data?.hasPin;
        localStorage.setItem(cacheKey, hasPin ? "1" : "0");
        setPinState((prev) => (prev === "verified" ? prev : hasPin ? "needs_verify" : "needs_setup"));
      } catch {
        setPinState((prev) => (prev === "loading" ? "needs_setup" : prev));
      }
    };

    void checkPin();
  }, [isAuthenticated, user]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (pinState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pinState === "needs_setup") {
    return <PinGate mode="setup" onSuccess={() => { if (user) localStorage.setItem(`pin_has:${user.id}`, "1"); setPinState("verified"); }} userId={user?.id} userEmail={user?.email} />;
  }


  if (pinState === "needs_verify") {
    return <PinGate mode="verify" onSuccess={() => setPinState("verified")} userId={user?.id} userEmail={user?.email} />;
  }

  // Páginas internas abrem sempre em tela cheia (sem dividir com o menu lateral)
  if (!isHome) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-background">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

        </header>
        <main className="flex-1 w-full p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border px-4 gap-3">
            <SidebarTrigger />

          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
