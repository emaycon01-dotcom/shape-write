import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldBan, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BlockedUser {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reason: string;
  blocked_at: string;
  status: string;
}

export default function AdminBloqueadosPage() {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBlocked = async () => {
    const { data } = await supabase
      .from("blocked_users")
      .select("*")
      .order("blocked_at", { ascending: false });
    if (data) setBlocked(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchBlocked();

    const channel = supabase
      .channel("blocked-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_users" }, () => {
        fetchBlocked();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleUnblock = async (id: string) => {
    await supabase.from("blocked_users").delete().eq("id", id);
    toast({ title: "Desbloqueado", description: "Usuário desbloqueado com sucesso." });
    fetchBlocked();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldBan className="w-5 h-5 text-destructive" />
          <h1 className="font-display text-2xl font-bold text-foreground">Bloqueados</h1>
        </div>
        <p className="text-sm text-muted-foreground">Usuários bloqueados automaticamente ou manualmente</p>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
      ) : blocked.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum usuário bloqueado.</div>
      ) : (
        <div className="space-y-3">
          {blocked.map((b) => (
            <div key={b.id} className="glass rounded-xl p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{b.user_name}</p>
                <p className="text-sm text-muted-foreground">{b.user_email}</p>
                <div className="flex gap-4 mt-1 text-xs">
                  <span className="text-muted-foreground">Motivo: <strong className="text-destructive">{b.reason}</strong></span>
                  <span className="text-muted-foreground">{new Date(b.blocked_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  b.status === "bloqueado" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {b.status}
                </span>
                <Button size="sm" variant="outline" onClick={() => handleUnblock(b.id)}>
                  <Unlock className="w-3.5 h-3.5 mr-1" /> Desbloquear
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
