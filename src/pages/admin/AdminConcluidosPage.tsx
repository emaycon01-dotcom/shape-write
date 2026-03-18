import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle } from "lucide-react";

interface LogEntry {
  id: string;
  user_name: string;
  user_email: string;
  document_type: string;
  created_at: string;
}

export default function AdminConcluidosPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("generation_logs")
        .select("*")
        .eq("stage", "completed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data as any);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("gen-logs-completed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "generation_logs" }, (payload) => {
        const row = payload.new as any;
        if (row.stage === "completed") setLogs((prev) => [row, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className="w-5 h-5 text-success" />
          <h1 className="font-display text-2xl font-bold text-foreground">Concluídos</h1>
        </div>
        <p className="text-sm text-muted-foreground">Documentos gerados com sucesso (pagos)</p>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum documento concluído.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Data</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 text-foreground font-medium">{l.user_name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{l.user_email}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">{l.document_type}</span></td>
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
