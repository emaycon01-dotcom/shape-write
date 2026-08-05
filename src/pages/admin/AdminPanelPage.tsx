import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Eye, DollarSign, ShieldBan, Crown, Search, Coins, Trash2,
  LayoutGrid, ScrollText, UserCog, Ban, KeyRound, RefreshCw, Plus, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Types ──
interface Profile {
  id: string; user_id: string; name: string; email: string;
  credits: number; plano: string; created_at: string;
}
interface UserRole { user_id: string; cargo: string }
interface LogEntry {
  id: string; user_name: string; user_email: string; document_type: string;
  stage: string; error_message: string | null; created_at: string;
}
interface Deposit {
  id: string; user_name: string; user_email: string; amount: number;
  method: string; created_at: string;
}
interface BlockedUser {
  id: string; user_id: string; user_name: string; user_email: string;
  reason: string; blocked_at: string; status: string;
}
interface Txn {
  id: string; user_id: string; actor_id: string | null; kind: string;
  amount: number; balance_after: number; reason: string; created_at: string;
}
interface FinTxn {
  id: string; user_id: string; type: string; amount: number;
  credits_amount: number; plan_name: string | null; status: string; created_at: string;
}

const NO_ROLE = "__none__";
const CARGOS = ["gerente", "admin"] as const;
const CARGO_LABELS: Record<string, string> = {
  dealer: "Dealer", master: "Master", diamond: "Diamond",
  sub_gerente: "Sub Gerente", gerente: "Gerente", admin: "Admin",
  [NO_ROLE]: "Sem cargo",
};
const PLANOS = ["free", "dealer", "master", "diamond"] as const;
const PLANO_LABELS: Record<string, string> = {
  free: "Free", dealer: "Basic", master: "Pro", diamond: "Premium",
};

type Tab =
  | "visao" | "usuarios" | "planos" | "equipe"
  | "financeiro" | "geracoes" | "bloqueados" | "auditoria";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "visao", label: "Visão geral", icon: LayoutGrid },
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "planos", label: "Planos", icon: Crown },
  { key: "equipe", label: "Equipe", icon: UserCog },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "geracoes", label: "Gerações", icon: Eye },
  { key: "bloqueados", label: "Bloqueados", icon: ShieldBan },
  { key: "auditoria", label: "Auditoria", icon: ScrollText },
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (v: string) => new Date(v).toLocaleString("pt-BR");

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    muted: "border-border/70 bg-secondary/50 text-muted-foreground",
    primary: "border-primary/40 bg-primary/10 text-primary",
    accent: "border-accent/40 bg-accent/10 text-accent",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur">
      <div className="absolute inset-0 gradient-primary opacity-[0.07]" />
      <div className="relative flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/70 ring-1 ring-border/60">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
          <p className="truncate font-display text-lg font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanelPage() {
  const [tab, setTab] = useState<Tab>("visao");
  const { toast } = useToast();
  const { user: me } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [finTxns, setFinTxns] = useState<FinTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Profile | null>(null);
  const [creditInput, setCreditInput] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const fetchAll = async () => {
    const [p, r, l, d, b, ct, ft] = await Promise.all([
      supabase.from("profiles").select("id, user_id, name, email, credits, plano, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, cargo"),
      supabase.from("generation_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("blocked_users").select("*").order("blocked_at", { ascending: false }),
      supabase.from("credit_transactions").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("financial_transactions").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    if (p.data) setProfiles(p.data as Profile[]);
    if (r.data) setRoles(r.data as UserRole[]);
    if (l.data) setLogs(l.data as LogEntry[]);
    if (d.data) setDeposits(d.data as Deposit[]);
    if (b.data) setBlocked(b.data as BlockedUser[]);
    if (ct.data) setTxns(ct.data as Txn[]);
    if (ft.data) setFinTxns(ft.data as FinTxn[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_logs" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_transactions" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleOf = (userId: string) =>
    roles.find((r) => r.user_id === userId)?.cargo ?? "";
  const isBlocked = (userId: string) =>
    blocked.some((b) => b.user_id === userId && b.status === "bloqueado");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.user_id.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  const totals = useMemo(() => {
    const totalCredits = profiles.reduce((s, p) => s + Number(p.credits), 0);
    const paid = finTxns.filter((t) => t.status === "pago");
    const revenue = paid.reduce((s, t) => s + Number(t.amount), 0) +
      deposits.reduce((s, d) => s + Number(d.amount), 0);
    return {
      users: profiles.length,
      totalCredits,
      revenue,
      geracoes: logs.filter((l) => l.stage !== "preview").length,
      bloqueados: blocked.filter((b) => b.status === "bloqueado").length,
    };
  }, [profiles, finTxns, deposits, logs, blocked]);

  // ── Ações ──
  const run = async (fn: () => PromiseLike<{ error: unknown }>, okMsg: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      const msg = (error as { message?: string })?.message ?? "Erro";
      toast({ title: "Falha na operação", description: msg, variant: "destructive" });
      return false;
    }
    toast({ title: okMsg });
    await fetchAll();
    return true;
  };

  const adjustCredits = async (delta: number) => {
    if (!selected) return;
    const amount = Number(creditInput);
    if (!amount || amount <= 0) {
      toast({ title: "Informe uma quantidade válida", variant: "destructive" });
      return;
    }
    const ok = await run(
      () => supabase.rpc("staff_adjust_credits", {
        _target_user_id: selected.user_id,
        _delta: delta * amount,
        _reason: reason || (delta > 0 ? "crédito manual" : "remoção manual"),
      }),
      delta > 0 ? `${amount} crédito(s) adicionado(s)` : `${amount} crédito(s) removido(s)`,
    );
    if (ok) {
      setCreditInput("");
      setReason("");
      setSelected((prev) =>
        prev ? { ...prev, credits: Math.max(0, prev.credits + delta * amount) } : prev,
      );
    }
  };

  const setPlan = (plano: string) =>
    selected &&
    run(() => supabase.rpc("admin_set_plan", { _target_user_id: selected.user_id, _plan: plano }),
      `Plano alterado para ${PLANO_LABELS[plano]}`).then((ok) => {
        if (ok) setSelected((p) => (p ? { ...p, plano } : p));
      });

  const setCargo = (cargo: string) => {
    if (!selected) return;
    const isNone = cargo === NO_ROLE;
    run(
      () =>
        isNone
          ? supabase.rpc("admin_clear_role", { _target_user_id: selected.user_id })
          : supabase.rpc("admin_set_role", {
              _target_user_id: selected.user_id,
              _cargo: cargo as (typeof CARGOS)[number],
            }),
      isNone ? "Cargo removido" : `Cargo alterado para ${CARGO_LABELS[cargo]}`,
    ).then((ok) => {
      if (ok) {
        setRoles((prev) => [
          ...prev.filter((r) => r.user_id !== selected.user_id),
          ...(isNone ? [] : [{ user_id: selected.user_id, cargo }]),
        ]);
      }
    });
  };

  const banUser = () =>
    selected &&
    run(() => supabase.rpc("admin_ban_user", {
      _target_user_id: selected.user_id,
      _reason: reason || "Banido pelo administrador",
    }), "Usuário banido");

  const unbanUser = (userId: string) =>
    run(() => supabase.rpc("admin_unban_user", { _target_user_id: userId }), "Usuário desbanido");

  const deleteUser = async () => {
    if (!selected) return;
    if (!confirm(`Excluir definitivamente a conta de ${selected.email}?`)) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "delete_user", user_id: selected.user_id },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Falha ao excluir conta", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Conta excluída" });
    setSelected(null);
    fetchAll();
  };

  const changePassword = async () => {
    if (!selected) return;
    if (newPassword.trim().length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.functions.invoke("admin-actions", {
      body: { action: "set_password", user_id: selected.user_id, password: newPassword.trim() },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Falha ao alterar a senha", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    toast({ title: "Senha alterada com sucesso" });
  };


  const UserRow = ({ p }: { p: Profile }) => (
    <button
      onClick={() => { setSelected(p); setCreditInput(""); setReason(""); setNewPassword(""); }}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/70 text-xs font-bold uppercase text-accent ring-1 ring-border/60">
        {(p.name || p.email || "?").slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{p.name || "Sem nome"}</p>
        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-bold text-foreground">{p.credits}</span>
        <div className="flex gap-1">
          <Badge tone={p.plano === "free" ? "muted" : "accent"}>{PLANO_LABELS[p.plano] ?? p.plano}</Badge>
          {roleOf(p.user_id) && <Badge tone="primary">{CARGO_LABELS[roleOf(p.user_id)]}</Badge>}
          {isBlocked(p.user_id) && <Badge tone="danger">Banido</Badge>}
        </div>
      </div>
    </button>
  );

  const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40">
              {r.map((c, j) => <td key={j} className="whitespace-nowrap px-4 py-2 text-foreground/90">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Painel administrativo</h1>
          <p className="text-xs text-muted-foreground">Gestão completa de usuários, planos e financeiro</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Menus */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === t.key
                ? "border-primary/50 gradient-button text-primary-foreground"
                : "border-border/60 bg-card/50 text-muted-foreground hover:border-primary/30"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "visao" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Usuários" value={String(totals.users)} icon={Users} />
            <Stat label="Créditos em circulação" value={String(totals.totalCredits)} icon={Coins} />
            <Stat label="Receita" value={brl(totals.revenue)} icon={DollarSign} />
            <Stat label="Gerações" value={String(totals.geracoes)} icon={Eye} />
            <Stat label="Banidos" value={String(totals.bloqueados)} icon={ShieldBan} />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Últimas movimentações</h2>
            <Table
              head={["Data", "Usuário", "Tipo", "Qtd", "Saldo", "Motivo"]}
              rows={txns.slice(0, 12).map((t) => [
                dt(t.created_at),
                profiles.find((p) => p.user_id === t.user_id)?.email ?? t.user_id.slice(0, 8),
                <Badge tone={t.kind === "debit" ? "danger" : "accent"}>{t.kind}</Badge>,
                String(t.amount),
                String(t.balance_after),
                t.reason,
              ])}
            />
          </div>
        </div>
      )}

      {(tab === "usuarios" || tab === "planos" || tab === "equipe") && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou ID"
            className="pl-9"
          />
        </div>
      )}

      {tab === "usuarios" && (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((p) => <UserRow key={p.id} p={p} />)}
        </div>
      )}

      {tab === "planos" && (
        <div className="space-y-5">
          {PLANOS.map((plano) => {
            const list = filtered.filter((p) => p.plano === plano);
            return (
              <div key={plano} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">{PLANO_LABELS[plano]}</h2>
                  <Badge>{list.length}</Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map((p) => <UserRow key={p.id} p={p} />)}
                  {list.length === 0 && <p className="text-xs text-muted-foreground">Nenhum usuário neste plano.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "equipe" && (
        <div className="space-y-5">
          {(["admin", "gerente", NO_ROLE] as const).map((cargo) => {
            const list = filtered.filter((p) =>
              cargo === NO_ROLE ? !roleOf(p.user_id) : roleOf(p.user_id) === cargo,
            );
            return (
              <div key={cargo} className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">{CARGO_LABELS[cargo]}</h2>
                  <Badge>{list.length}</Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {list.map((p) => <UserRow key={p.id} p={p} />)}
                  {list.length === 0 && <p className="text-xs text-muted-foreground">Ninguém neste cargo.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "financeiro" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Receita total" value={brl(totals.revenue)} icon={DollarSign} />
            <Stat label="Cobranças pagas" value={String(finTxns.filter((t) => t.status === "pago").length)} icon={Coins} />
            <Stat label="Pendentes" value={String(finTxns.filter((t) => t.status !== "pago").length)} icon={ScrollText} />
            <Stat label="Depósitos" value={String(deposits.length)} icon={Plus} />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Cobranças PIX</h2>
            <Table
              head={["Data", "Usuário", "Tipo", "Valor", "Créditos", "Plano", "Status"]}
              rows={finTxns.map((t) => [
                dt(t.created_at),
                profiles.find((p) => p.user_id === t.user_id)?.email ?? t.user_id.slice(0, 8),
                t.type,
                brl(Number(t.amount)),
                String(t.credits_amount),
                t.plan_name ?? "—",
                <Badge tone={t.status === "pago" ? "accent" : "muted"}>{t.status}</Badge>,
              ])}
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Depósitos confirmados</h2>
            <Table
              head={["Data", "Usuário", "E-mail", "Valor", "Método"]}
              rows={deposits.map((d) => [dt(d.created_at), d.user_name, d.user_email, brl(Number(d.amount)), d.method])}
            />
          </div>
        </div>
      )}

      {tab === "geracoes" && (
        <Table
          head={["Data", "Usuário", "E-mail", "Documento", "Etapa", "Erro"]}
          rows={logs.map((l) => [
            dt(l.created_at), l.user_name, l.user_email,
            l.document_type.toUpperCase(),
            <Badge tone={l.stage === "preview" ? "muted" : "accent"}>{l.stage}</Badge>,
            l.error_message ?? "—",
          ])}
        />
      )}

      {tab === "bloqueados" && (
        <Table
          head={["Data", "Usuário", "E-mail", "Motivo", "Ação"]}
          rows={blocked.map((b) => [
            dt(b.blocked_at), b.user_name, b.user_email, b.reason,
            <Button size="sm" variant="outline" onClick={() => unbanUser(b.user_id)}>Desbanir</Button>,
          ])}
        />
      )}

      {tab === "auditoria" && (
        <Table
          head={["Data", "Usuário", "Operador", "Tipo", "Qtd", "Saldo", "Motivo"]}
          rows={txns.map((t) => [
            dt(t.created_at),
            profiles.find((p) => p.user_id === t.user_id)?.email ?? t.user_id.slice(0, 8),
            t.actor_id ? (profiles.find((p) => p.user_id === t.actor_id)?.email ?? t.actor_id.slice(0, 8)) : "—",
            <Badge tone={t.kind === "debit" ? "danger" : "accent"}>{t.kind}</Badge>,
            String(t.amount), String(t.balance_after), t.reason,
          ])}
        />
      )}

      {/* Dialogo do usuário */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="truncate">{selected.name || "Sem nome"}</DialogTitle>
                <DialogDescription className="truncate">{selected.email}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{PLANO_LABELS[selected.plano] ?? selected.plano}</Badge>
                {roleOf(selected.user_id) && <Badge tone="primary">{CARGO_LABELS[roleOf(selected.user_id)]}</Badge>}
                {isBlocked(selected.user_id) && <Badge tone="danger">Banido</Badge>}
                <Badge>Saldo: {selected.credits}</Badge>
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <p className="text-xs font-semibold text-foreground">Créditos</p>
                <Input
                  type="number"
                  min={1}
                  value={creditInput}
                  onChange={(e) => setCreditInput(e.target.value)}
                  placeholder="Quantidade de créditos"
                />
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                />
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={busy} onClick={() => adjustCredits(1)}>
                    <Plus className="mr-1 h-4 w-4" /> Adicionar
                  </Button>
                  <Button className="flex-1" variant="outline" disabled={busy} onClick={() => adjustCredits(-1)}>
                    <Minus className="mr-1 h-4 w-4" /> Remover
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Plano</p>
                  <Select value={selected.plano} onValueChange={setPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANOS.map((p) => <SelectItem key={p} value={p}>{PLANO_LABELS[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Cargo</p>
                  <Select value={roleOf(selected.user_id) || NO_ROLE} onValueChange={setCargo}>
                    <SelectTrigger><SelectValue placeholder="Sem cargo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ROLE}>Sem cargo</SelectItem>
                      {CARGOS.map((c) => <SelectItem key={c} value={c}>{CARGO_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 border-t border-border/50 pt-3">
                <label className="text-xs font-medium text-muted-foreground">Alterar senha do usuário</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Nova senha (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button size="sm" variant="outline" disabled={busy} onClick={changePassword}>
                    <KeyRound className="mr-1 h-4 w-4" /> Alterar
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                {isBlocked(selected.user_id) ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => unbanUser(selected.user_id)}>
                    <ShieldBan className="mr-1 h-4 w-4" /> Desbanir
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || selected.user_id === me?.id}
                    onClick={banUser}
                  >
                    <Ban className="mr-1 h-4 w-4" /> Banir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy || selected.user_id === me?.id}
                  onClick={deleteUser}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir conta
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
