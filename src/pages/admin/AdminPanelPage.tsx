import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Eye, CheckCircle, AlertTriangle, DollarSign, ShieldBan,
  Crown, Plus, Minus, TrendingUp, Unlock, Smartphone, Coins, Calculator,
  ArrowUp, ArrowDown, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Types ──
interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  credits: number;
  plano: string;
}
interface UserRole { user_id: string; cargo: string; }
interface LogEntry {
  id: string;
  user_name: string;
  user_email: string;
  document_type: string;
  stage: string;
  error_message: string | null;
  created_at: string;
}
interface Deposit {
  id: string;
  user_name: string;
  user_email: string;
  amount: number;
  method: string;
  created_at: string;
}
interface BlockedUser {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reason: string;
  blocked_at: string;
  status: string;
}
interface RechargeLog {
  id: string;
  amount: number;
  credits_used: number;
  created_at: string;
}

const CARGOS = ["dealer", "master", "diamond", "sub_gerente", "gerente", "admin"] as const;
const CARGO_LABELS: Record<string, string> = {
  dealer: "DEALER", master: "MASTER", diamond: "DIAMOND",
  sub_gerente: "SUB GERENTE", gerente: "GERENTE", admin: "ADMIN",
};
const PLANOS = ["free", "basico", "intermediario", "avancado", "premium", "vip"];

type Tab = "usuarios" | "revendedores" | "geracoes" | "financeiro" | "bloqueados";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "usuarios", label: "Usuários", icon: Users },
  { key: "revendedores", label: "Revendedores", icon: Crown },
  { key: "geracoes", label: "Gerações", icon: Eye },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "bloqueados", label: "Bloqueados", icon: ShieldBan },
];

export default function AdminPanelPage() {
  const [tab, setTab] = useState<Tab>("usuarios");
  const { toast } = useToast();

  // ── Shared data ──
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [rechargeLogs, setRechargeLogs] = useState<RechargeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ── Credit/Plan dialog ──
  const [creditDialog, setCreditDialog] = useState<{ userId: string; type: "add" | "remove" } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [planDialog, setPlanDialog] = useState<{ userId: string; current: string } | null>(null);
  const [newPlan, setNewPlan] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    const [p, r, l, d, b, rc] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("generation_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("blocked_users").select("*").order("blocked_at", { ascending: false }),
      supabase.from("recharge_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (p.data) setProfiles(p.data as any);
    if (r.data) setRoles(r.data as any);
    if (l.data) setLogs(l.data as any);
    if (d.data) setDeposits(d.data as any);
    if (b.data) setBlocked(b.data as any);
    if (rc.data) setRechargeLogs(rc.data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch1 = supabase.channel("admin-gen").on("postgres_changes", { event: "*", schema: "public", table: "generation_logs" }, () => fetchAll()).subscribe();
    const ch2 = supabase.channel("admin-dep").on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, () => fetchAll()).subscribe();
    const ch3 = supabase.channel("admin-block").on("postgres_changes", { event: "*", schema: "public", table: "blocked_users" }, () => fetchAll()).subscribe();
    const ch4 = supabase.channel("admin-profiles").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchAll()).subscribe();
    return () => { [ch1, ch2, ch3, ch4].forEach(c => supabase.removeChannel(c)); };
  }, []);

  const getUserCargo = (userId: string) => roles.find(r => r.user_id === userId)?.cargo;

  // ── User actions ──
  const handleCreditSubmit = async () => {
    if (!creditDialog || !creditAmount) return;
    const amt = Number(creditAmount);
    if (isNaN(amt) || amt <= 0) return;
    const profile = profiles.find(p => p.user_id === creditDialog.userId);
    if (!profile) return;
    const newCredits = creditDialog.type === "add" ? profile.credits + amt : Math.max(0, profile.credits - amt);
    await supabase.from("profiles").update({ credits: newCredits } as any).eq("user_id", creditDialog.userId);
    toast({ title: creditDialog.type === "add" ? "Créditos adicionados" : "Créditos removidos" });
    setCreditDialog(null);
    setCreditAmount("");
    fetchAll();
  };

  const handlePlanSubmit = async () => {
    if (!planDialog || !newPlan) return;
    await supabase.from("profiles").update({ plano: newPlan } as any).eq("user_id", planDialog.userId);
    toast({ title: "Plano alterado", description: `Plano alterado para ${newPlan}` });
    setPlanDialog(null);
    setNewPlan("");
    fetchAll();
  };

  const handlePromote = async (userId: string) => {
    const current = getUserCargo(userId);
    const idx = current ? CARGOS.indexOf(current as any) : -1;
    if (idx >= CARGOS.length - 1) return;
    const next = CARGOS[idx + 1];
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, cargo: next } as any);
    toast({ title: "Patente aumentada", description: CARGO_LABELS[next] });
    fetchAll();
  };

  const handleDemote = async (userId: string) => {
    const current = getUserCargo(userId);
    const idx = current ? CARGOS.indexOf(current as any) : -1;
    if (idx <= 0) {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      toast({ title: "Patente removida" });
    } else {
      const prev = CARGOS[idx - 1];
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, cargo: prev } as any);
      toast({ title: "Patente diminuída", description: CARGO_LABELS[prev] });
    }
    fetchAll();
  };

  const handleUnblock = async (id: string) => {
    await supabase.from("blocked_users").delete().eq("id", id);
    toast({ title: "Desbloqueado" });
    fetchAll();
  };

  // ── Derived data ──
  const totalDeposits = deposits.reduce((s, d) => s + Number(d.amount), 0);
  const totalRecharges = rechargeLogs.reduce((s, l) => s + Number(l.amount), 0);
  const totalRechargeCount = rechargeLogs.length;

  const previewLogs = logs.filter(l => l.stage === "preview");
  const completedLogs = logs.filter(l => l.stage === "completed");
  const failedLogs = logs.filter(l => l.stage === "failed" || l.stage === "failed_preview");
  const allGenLogs = [...previewLogs, ...completedLogs, ...failedLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );
  const revendedores = profiles.filter(p => p.plano !== "free");

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Menu Admin</h1>
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Menu Admin</h1>
        <p className="text-sm text-muted-foreground">Central de gerenciamento do sistema</p>
      </div>

      {/* Tab grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); }}
            className={`glass rounded-xl p-4 flex flex-col items-center gap-2 transition-all border ${
              tab === t.key ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
            }`}
          >
            <t.icon className={`w-5 h-5 ${tab === t.key ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-xs font-semibold tracking-wider ${tab === t.key ? "text-primary" : "text-muted-foreground"}`}>
              {t.label.toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      {/* ═══ USUÁRIOS ═══ */}
      {tab === "usuarios" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Créditos</th>
                  <th className="py-3 px-4">Patente</th>
                  <th className="py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => {
                  const cargo = getUserCargo(p.user_id);
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 text-foreground font-medium">{p.name || "Sem nome"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase">{p.plano}</span>
                      </td>
                      <td className="py-3 px-4 text-foreground font-semibold">{p.credits}</td>
                      <td className="py-3 px-4">
                        {cargo ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">{CARGO_LABELS[cargo] || cargo}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setCreditDialog({ userId: p.user_id, type: "add" })}>
                            <Plus className="w-3 h-3 mr-0.5" /> Créd
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setCreditDialog({ userId: p.user_id, type: "remove" })}>
                            <Minus className="w-3 h-3 mr-0.5" /> Créd
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => { setPlanDialog({ userId: p.user_id, current: p.plano }); setNewPlan(p.plano); }}>
                            Plano
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handlePromote(p.user_id)}>
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handleDemote(p.user_id)}>
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ REVENDEDORES ═══ */}
      {tab === "revendedores" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Usuários com planos ativos</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Créditos</th>
                </tr>
              </thead>
              <tbody>
                {revendedores.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum revendedor encontrado.</td></tr>
                ) : revendedores.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{p.name || "Sem nome"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.email}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs text-accent">
                        <Crown className="w-3 h-3" /> {p.plano}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground font-semibold">{p.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ GERAÇÕES ═══ */}
      {tab === "geracoes" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-[10px] tracking-widest text-muted-foreground mb-1">TOTAL GERAÇÕES</p>
              <p className="text-2xl font-bold text-foreground">{allGenLogs.length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-3 h-3 text-success" />
                <p className="text-[10px] tracking-widest text-muted-foreground">CONCLUÍDAS</p>
              </div>
              <p className="text-2xl font-bold text-success">{completedLogs.length}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <p className="text-[10px] tracking-widest text-muted-foreground">FALHAS</p>
              </div>
              <p className="text-2xl font-bold text-destructive">{failedLogs.length}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Data</th>
                </tr>
              </thead>
              <tbody>
                {allGenLogs.slice(0, 200).map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{l.user_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{l.document_type}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        l.stage === "completed" ? "bg-success/10 text-success" :
                        l.stage === "preview" ? "bg-primary/10 text-primary" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {l.stage === "completed" ? "Concluído" : l.stage === "preview" ? "Prévia" : "Falha"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ FINANCEIRO ═══ */}
      {tab === "financeiro" && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 border border-success/20">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-success" />
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground">TOTAL DE DEPÓSITOS DO SISTEMA</p>
                <p className="text-3xl font-bold text-foreground">R$ {totalDeposits.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-xs tracking-widest text-muted-foreground font-medium">RECARGAS CELULAR</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold text-foreground">R$ {totalRecharges.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Operações</p>
                  <p className="text-xl font-bold text-foreground">{totalRechargeCount}</p>
                </div>
              </div>
            </div>
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-4 h-4 text-accent" />
                <span className="text-xs tracking-widest text-muted-foreground font-medium">ESIM DIGITAL</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-xl font-bold text-foreground">R$ 0.00</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Operações</p>
                  <p className="text-xl font-bold text-foreground">0</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span className="text-xs tracking-widest text-muted-foreground font-medium">TOTAL GERAL</span>
            </div>
            <p className="text-2xl font-bold text-foreground">R$ {(totalRecharges + 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Soma: Recargas + Esim (atualização em tempo real)</p>
          </div>

          <div>
            <h3 className="text-xs tracking-widest text-muted-foreground font-medium mb-3">HISTÓRICO DE DEPÓSITOS</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map(d => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 text-foreground font-medium">{d.user_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{d.user_email}</td>
                      <td className="py-3 px-4 text-success font-semibold">R$ {Number(d.amount).toFixed(2)}</td>
                      <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase">{d.method}</span></td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BLOQUEADOS ═══ */}
      {tab === "bloqueados" && (
        <div className="space-y-4">
          {blocked.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum usuário bloqueado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {blocked.map(b => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 text-foreground font-medium">{b.user_name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{b.user_email}</td>
                      <td className="py-3 px-4 text-destructive text-xs font-semibold">{b.reason}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.status === "bloqueado" ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-500"
                        }`}>{b.status}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(b.blocked_at).toLocaleString("pt-BR")}</td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUnblock(b.id)}>
                          <Unlock className="w-3 h-3 mr-1" /> Desbloquear
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Credit Dialog ── */}
      <Dialog open={!!creditDialog} onOpenChange={() => setCreditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{creditDialog?.type === "add" ? "Adicionar Créditos" : "Remover Créditos"}</DialogTitle>
          </DialogHeader>
          <Input type="number" placeholder="Quantidade" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} min="1" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(null)}>Cancelar</Button>
            <Button onClick={handleCreditSubmit}>{creditDialog?.type === "add" ? "Adicionar" : "Remover"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Plan Dialog ── */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
          </DialogHeader>
          <Select value={newPlan} onValueChange={setNewPlan}>
            <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
            <SelectContent>
              {PLANOS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(null)}>Cancelar</Button>
            <Button onClick={handlePlanSubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
