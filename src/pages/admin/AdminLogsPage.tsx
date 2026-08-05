import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText, Search, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface StaffLog {
  id: string;
  actor_name: string;
  actor_email: string;
  actor_cargo: string;
  target_name: string;
  target_email: string;
  delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

interface ActionLog {
  id: string;
  actor_name: string;
  actor_email: string;
  actor_cargo: string;
  target_name: string;
  target_email: string;
  action: string;
  details: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  set_password: "ALTEROU A SENHA",
  delete_user: "EXCLUIU A CONTA",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<StaffLog[]>([]);
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [tab, setTab] = useState<"creditos" | "acoes">("creditos");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cargo, setCargo] = useState("todos");

  const fetchLogs = async () => {
    setLoading(true);
    const [{ data }, { data: actionData }] = await Promise.all([
      supabase
        .from("staff_credit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("staff_action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setLogs((data as StaffLog[]) ?? []);
    setActions((actionData as ActionLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actions.filter((l) => {
      if (cargo !== "todos" && l.actor_cargo !== cargo) return false;
      if (!q) return true;
      return (
        l.actor_name.toLowerCase().includes(q) ||
        l.actor_email.toLowerCase().includes(q) ||
        l.target_name.toLowerCase().includes(q) ||
        l.target_email.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    });
  }, [actions, query, cargo]);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (cargo !== "todos" && l.actor_cargo !== cargo) return false;
      if (!q) return true;
      return (
        l.actor_name.toLowerCase().includes(q) ||
        l.actor_email.toLowerCase().includes(q) ||
        l.target_name.toLowerCase().includes(q) ||
        l.target_email.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
      );
    });
  }, [logs, query, cargo]);

  const totals = useMemo(() => {
    const g = filtered.filter((l) => l.actor_cargo === "gerente");
    return {
      registros: filtered.length,
      gerente: g.length,
      dados: g.reduce((s, l) => s + Math.max(0, Number(l.delta)), 0),
      retirados: g.reduce((s, l) => s + Math.max(0, -Number(l.delta)), 0),
    };
  }, [filtered]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> LOGS DE STAFF
          </h1>
          <p className="text-sm text-muted-foreground">
            Tudo que gerentes e admins fizeram: créditos e ações em contas.
          </p>

        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      <div className="flex gap-2">
        <Button
          variant={tab === "creditos" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("creditos")}
        >
          CRÉDITOS
        </Button>
        <Button
          variant={tab === "acoes" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("acoes")}
        >
          AÇÕES EM CONTAS ({filteredActions.length})
        </Button>
      </div>

      <div className={`grid gap-3 sm:grid-cols-4 ${tab === "creditos" ? "" : "hidden"}`}>

        {[
          { label: "Registros", value: totals.registros },
          { label: "Ações de gerentes", value: totals.gerente },
          { label: "Créditos dados (gerentes)", value: totals.dados },
          { label: "Créditos removidos (gerentes)", value: totals.retirados },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por gerente, usuário ou motivo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={cargo} onValueChange={setCargo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os cargos</SelectItem>
            <SelectItem value="gerente">Somente gerentes</SelectItem>
            <SelectItem value="admin">Somente admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tab === "acoes" ? (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left">
                <th className="p-3 font-semibold">DATA</th>
                <th className="p-3 font-semibold">QUEM FEZ</th>
                <th className="p-3 font-semibold">PARA QUEM</th>
                <th className="p-3 font-semibold">AÇÃO</th>
                <th className="p-3 font-semibold">DETALHES</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredActions.map((l) => (
                <tr key={l.id} className="hover:bg-secondary/30">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(l.created_at)}</td>
                  <td className="p-3">
                    <p className="font-medium">{l.actor_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.actor_email} · {l.actor_cargo.toUpperCase()}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{l.target_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{l.target_email}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      {ACTION_LABELS[l.action] || l.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{l.details || "—"}</td>
                </tr>
              ))}
              {!filteredActions.length && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {loading ? "Carregando..." : "Nenhuma ação registrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="rounded-xl border bg-card overflow-x-auto">

        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr className="text-left">
              <th className="p-3 font-semibold">DATA</th>
              <th className="p-3 font-semibold">QUEM FEZ</th>
              <th className="p-3 font-semibold">PARA QUEM</th>
              <th className="p-3 font-semibold">MOVIMENTO</th>
              <th className="p-3 font-semibold">SALDO FINAL</th>
              <th className="p-3 font-semibold">MOTIVO</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((l) => {
              const positivo = Number(l.delta) > 0;
              return (
                <tr key={l.id} className="hover:bg-secondary/30">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmt(l.created_at)}</td>
                  <td className="p-3">
                    <p className="font-medium">{l.actor_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.actor_email} · {l.actor_cargo.toUpperCase()}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{l.target_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{l.target_email}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        positivo
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {positivo ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {positivo ? "+" : ""}
                      {Number(l.delta)}
                    </span>
                  </td>
                  <td className="p-3">{Number(l.balance_after)}</td>
                  <td className="p-3 text-muted-foreground">{l.reason || "—"}</td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {loading ? "Carregando..." : "Nenhum registro encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
