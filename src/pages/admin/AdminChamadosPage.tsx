import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TicketThread, type Ticket } from "@/components/SupportWidget";
import { Headphones, Search } from "lucide-react";

type Filter = "aberto" | "encerrado";

export default function AdminChamadosPage() {
  const [filter, setFilter] = useState<Filter>("aberto");
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, category, status, created_at, user_name, user_email")
      .eq("status", filter)
      .order("updated_at", { ascending: false })
      .limit(200);
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const term = q.trim().toLowerCase();
  const list = term
    ? tickets.filter(
        (t) =>
          t.subject.toLowerCase().includes(term) ||
          (t.user_email ?? "").toLowerCase().includes(term) ||
          (t.user_name ?? "").toLowerCase().includes(term),
      )
    : tickets;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
          <Headphones className="h-5 w-5 text-primary-foreground" />
        </span>
        <div>
          <h1 className="text-xl font-bold">Chamados de Suporte</h1>
          <p className="text-sm text-muted-foreground">Converse com os clientes e encerre chamados.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["aberto", "encerrado"] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => {
              setFilter(f);
              setActive(null);
            }}
          >
            {f === "aberto" ? "Abertos" : "Encerrados"}
          </Button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por assunto ou cliente" className="pl-8" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && list.length === 0 && (
            <p className="rounded-lg border border-border/60 p-6 text-center text-sm text-muted-foreground">
              Nenhum chamado {filter === "aberto" ? "aberto" : "encerrado"}.
            </p>
          )}
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                active?.id === t.id ? "border-primary bg-secondary/60" : "border-border/60 hover:bg-secondary/40"
              }`}
            >
              <p className="truncate text-sm font-medium">{t.subject}</p>
              <p className="truncate text-xs text-muted-foreground">{t.user_name || t.user_email}</p>
              <p className="text-[11px] text-muted-foreground">
                {t.category} · {new Date(t.created_at).toLocaleString("pt-BR")}
              </p>
            </button>
          ))}
        </div>

        <div className="min-h-[480px] rounded-xl border border-border/60 bg-card/60">
          {active ? (
            <div className="h-[560px]">
              <TicketThread
                key={active.id}
                ticket={active}
                isAdmin
                onClose={() => setActive(null)}
                onClosed={() => {
                  setActive(null);
                  void load();
                }}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-muted-foreground">
              Selecione um chamado para conversar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
