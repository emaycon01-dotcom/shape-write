import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Conta os pedidos de conta pendentes (admins e gerentes), em tempo real + atualização por hora. */
export function usePendingApprovals() {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "gerente";
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!isStaff) {
      setCount(0);
      return;
    }
    const { count: c } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    setCount(c ?? 0);
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    void load();

    const channel = supabase
      .channel("pending-approvals-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void load(),
      )
      .subscribe();

    // Atualização automática a cada 1 hora
    const interval = window.setInterval(() => void load(), 60 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [isStaff, load]);

  return { count, isStaff, refresh: load };
}
