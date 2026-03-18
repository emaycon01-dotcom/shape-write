import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

interface LogEntry {
  id: string;
  user_name: string;
  user_email: string;
  document_type: string;
  stage: string;
  error_message: string | null;
  created_at: string;
}

export default function AdminCanceladosPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("generation_logs")
        .select("*")
        .eq("stage", "failed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data as any);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("gen-logs-failed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "generation_logs" }, (payload) => {
        const row = payload.new as any;
        if (row.stage === "failed") setLogs((prev) => [row, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h1 className="font-display text-2xl font-bold text-foreground">Cancelados / Falhas</h1>
        </div>
        <p className="text-sm text-muted-foreground">Erros e falhas registrados no sistema</p>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhuma falha registrada.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Tipo de Erro</th>
                <th className="py-3 px-4">Estágio</th>
                <th className="py-3 px-4">Data</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 text-foreground font-medium">{l.user_name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{l.user_email}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">{l.document_type}</span></td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{l.error_message || "Erro desconhecido"}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] uppercase">
                      {l.stage === "failed_preview" ? "Prévia" : "PDF Final"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
