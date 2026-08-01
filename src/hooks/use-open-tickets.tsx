import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Conta os chamados de suporte abertos (admins e gerentes) com atualização em tempo real. */
export function useOpenTickets() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "gerente";
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setCount(0);
      return;
    }
    const { count: c } = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "aberto");
    setCount(c ?? 0);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();

    const channel = supabase
      .channel("support-tickets-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => void load(),
      )
      .subscribe();

    const interval = window.setInterval(() => void load(), 60_000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  return { count, isAdmin, refresh: load };
}
