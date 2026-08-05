import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Search, Plus, Minus, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  user_id: string;
  name: string;
  email: string;
  credits: number;
  plano: string;
}

const GERENTE_MAX = 5;

export default function AdminCreditosPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const maxPerOp = isAdmin ? Infinity : GERENTE_MAX;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id,name,email,credits,plano")
      .order("name");
    setProfiles((data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles.slice(0, 30);
    return profiles
      .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 30);
  }, [profiles, query]);

  const adjust = async (sign: 1 | -1) => {
    if (!selected) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      toast({ title: "Informe uma quantidade válida", variant: "destructive" });
      return;
    }
    if (value > maxPerOp) {
      toast({
        title: `Limite de ${GERENTE_MAX} créditos por operação`,
        description: "Gerentes podem dar ou remover no máximo 5 créditos de uma única vez.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("staff_adjust_credits", {
      _target_user_id: selected.user_id,
      _delta: sign * value,
      _reason: reason.trim() || (sign > 0 ? "crédito manual" : "remoção manual"),
    });
    setBusy(false);
    if (error) {
      const map: Record<string, string> = {
        limit_exceeded: "Gerentes podem movimentar no máximo 5 créditos por operação.",
        cannot_change_self: "Você não pode alterar os próprios créditos.",
        forbidden: "Sem permissão para esta ação.",
        profile_not_found: "Usuário não encontrado.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      toast({
        title: "Falha na operação",
        description: key ? map[key] : error.message,
        variant: "destructive",
      });
      return;
    }
    const novo = Number(data);
    toast({
      title: sign > 0 ? `${value} crédito(s) adicionado(s)` : `${value} crédito(s) removido(s)`,
      description: `Novo saldo: ${novo}`,
    });
    setAmount("");
    setReason("");
    setSelected((p) => (p ? { ...p, credits: novo } : p));
    setProfiles((prev) =>
      prev.map((p) => (p.user_id === selected.user_id ? { ...p, credits: novo } : p)),
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" /> GESTÃO DE CRÉDITOS
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Adicione ou remova créditos de qualquer conta."
              : `Gerentes podem dar ou remover no máximo ${GERENTE_MAX} créditos por operação.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProfiles} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      {!isAdmin && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <span>
            Todas as movimentações de crédito feitas por gerentes ficam registradas e são
            auditadas pelos administradores.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border bg-card">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou e-mail"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="divide-y max-h-[60vh] overflow-auto">
            {filtered.map((p) => (
              <button
                key={p.user_id}
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 hover:bg-secondary/50 transition ${
                  selected?.user_id === p.user_id ? "bg-secondary" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{Number(p.credits)} cr</span>
                </div>
              </button>
            ))}
            {!filtered.length && (
              <p className="p-6 text-sm text-muted-foreground text-center">
                {loading ? "Carregando..." : "Nenhum usuário encontrado."}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-4 h-fit">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Selecione um usuário para ajustar o saldo.</p>
          ) : (
            <>
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-xs text-muted-foreground break-all">{selected.email}</p>
                <p className="mt-2 text-2xl font-bold">{Number(selected.credits)} <span className="text-sm font-normal text-muted-foreground">créditos</span></p>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Quantidade {isAdmin ? "" : `(máx. ${GERENTE_MAX})`}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={isAdmin ? undefined : GERENTE_MAX}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
                <label className="text-xs text-muted-foreground">Motivo</label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex.: bônus, correção, estorno"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => adjust(1)} disabled={busy}>
                  <Plus className="mr-1 h-4 w-4" /> Dar
                </Button>
                <Button variant="destructive" onClick={() => adjust(-1)} disabled={busy}>
                  <Minus className="mr-1 h-4 w-4" /> Remover
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
