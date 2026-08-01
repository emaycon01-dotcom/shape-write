import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, RefreshCw, Search, ShieldCheck, ShieldOff } from "lucide-react";

interface Row {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: string;
  verified: boolean;
  created_at: string;
  verified_at: string | null;
}

const dt = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const FILTERS = [
  { key: "nao", label: "Não verificadas", icon: ShieldOff },
  { key: "sim", label: "Verificadas", icon: ShieldCheck },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function AdminVerificacoesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("nao");
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, name, email, status, verified, created_at, verified_at")
      .eq("status", "aprovado")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar contas", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const setVerified = async (row: Row, verified: boolean) => {
    setBusy(row.user_id);
    const { error } = await supabase.rpc("admin_set_verified", {
      _target_user_id: row.user_id,
      _verified: verified,
    });
    setBusy(null);
    if (error) {
      toast({ title: "Falha na ação", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: verified ? "Conta verificada" : "Verificação removida",
      description: row.email,
    });
    setRows((prev) =>
      prev.map((r) =>
        r.user_id === row.user_id ? { ...r, verified, verified_at: verified ? new Date().toISOString() : null } : r,
      ),
    );
  };

  const counts = useMemo(
    () => ({
      nao: rows.filter((r) => !r.verified).length,
      sim: rows.filter((r) => r.verified).length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "sim" ? r.verified : !r.verified))
      .filter((r) => !q || r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
  }, [rows, filter, search]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/70 ring-1 ring-border/60">
            <BadgeCheck className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Verificar contas</h1>
            <p className="text-xs text-muted-foreground">
              Contas não verificadas entram no painel, mas não veem nem geram nenhum documento
            </p>
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
                {r.verified && ` · Verificada: ${dt(r.verified_at)}`}
              </p>
            </div>

            <div className="flex gap-2">
              {!r.verified ? (
                <Button size="sm" disabled={busy === r.user_id} onClick={() => void setVerified(r, true)}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Verificar conta
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy === r.user_id}
                  onClick={() => void setVerified(r, false)}
                >
                  <ShieldOff className="mr-1.5 h-4 w-4" />
                  Remover verificação
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
