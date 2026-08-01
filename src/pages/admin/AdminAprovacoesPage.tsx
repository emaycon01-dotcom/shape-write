import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock, RefreshCw, Search, UserCheck, XCircle } from "lucide-react";

interface Pending {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  approved_at: string | null;
}

const dt = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const FILTERS = [
  { key: "pendente", label: "Em análise", icon: Clock },
  { key: "aprovado", label: "Aprovados", icon: CheckCircle2 },
  { key: "rejeitado", label: "Recusados", icon: XCircle },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function AdminAprovacoesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pendente");
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, name, email, status, created_at, approved_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar contas", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as Pending[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const setStatus = async (row: Pending, status: FilterKey) => {
    setBusy(row.user_id);
    const { error } = await supabase.rpc("admin_set_account_status", {
      _target_user_id: row.user_id,
      _status: status,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Falha na ação", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: status === "aprovado" ? "Conta aprovada" : status === "rejeitado" ? "Conta recusada" : "Conta em análise",
      description: row.email,
    });
    setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, status } : r)));
  };

  const counts = useMemo(
    () => ({
      pendente: rows.filter((r) => r.status === "pendente").length,
      aprovado: rows.filter((r) => r.status === "aprovado").length,
      rejeitado: rows.filter((r) => r.status === "rejeitado").length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.status === filter)
      .filter((r) => !q || r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
  }, [rows, filter, search]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/70 ring-1 ring-border/60">
            <UserCheck className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Aprovação de contas</h1>
            <p className="text-xs text-muted-foreground">Libere ou recuse o acesso de novos cadastros</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              filter === f.key
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-border/60 bg-card/50 text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <f.icon className="h-4 w-4" />
            {f.label}
            <span className="rounded-md bg-secondary/70 px-1.5 text-[11px] font-semibold">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loading && visible.length === 0 && (
          <p className="rounded-xl border border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Nenhuma conta nesta lista.
          </p>
        )}

        {visible.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{r.name || "Sem nome"}</p>
              <p className="truncate text-xs text-muted-foreground">{r.email}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Cadastro: {dt(r.created_at)}
                {r.status === "aprovado" && ` · Aprovado: ${dt(r.approved_at)}`}
              </p>
            </div>

            <div className="flex gap-2">
              {r.status !== "aprovado" && (
                <Button size="sm" disabled={busy === r.user_id} onClick={() => void setStatus(r, "aprovado")}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Aprovar
                </Button>
              )}
              {r.status !== "rejeitado" && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy === r.user_id}
                  onClick={() => void setStatus(r, "rejeitado")}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Recusar
                </Button>
              )}
              {r.status !== "pendente" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.user_id}
                  onClick={() => void setStatus(r, "pendente")}
                >
                  <Clock className="mr-1.5 h-4 w-4" />
                  Reanalisar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
