import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye } from "lucide-react";

interface LogEntry {
  id: string;
  user_name: string;
  user_email: string;
  document_type: string;
  created_at: string;
}

export default function AdminGeracoesPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("generation_logs")
        .select("*")
        .eq("stage", "preview")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLogs(data as any);
      setLoading(false);
    };
    fetch();

    const channel = supabase
      .channel("gen-logs-preview")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "generation_logs" }, (payload) => {
        const row = payload.new as any;
        if (row.stage === "preview") setLogs((prev) => [row, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-5 h-5 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold text-foreground">Gerações (Prévias)</h1>
        </div>
        <p className="text-sm text-muted-foreground">Monitoramento de todas as prévias geradas — atualização em tempo real</p>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhuma prévia registrada.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 text-foreground font-medium">{l.user_name}</td>
                  <td className="py-3 px-4 text-muted-foreground">{l.user_email}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{l.document_type}</span></td>
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
