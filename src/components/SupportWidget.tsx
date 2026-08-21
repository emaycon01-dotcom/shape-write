import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Headphones, MessageCircle, Plus, Send, X, Phone, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

export type TicketMessage = {
  id: string;
  body: string;
  author_name: string;
  is_admin: boolean;
  created_at: string;
};

export const CATEGORIAS = ["Geral", "Financeiro", "Documentos", "Conta", "Bug"];

export function TicketThread({
  ticket,
  isAdmin,
  onClose,
  onClosed,
}: {
  ticket: Ticket;
  isAdmin: boolean;
  onClose: () => void;
  onClosed?: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("id, body, author_name, is_admin, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at");
    setMessages((data as TicketMessage[]) ?? []);
  }, [ticket.id]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: user.id,
      author_name: isAdmin ? "Suporte" : user.name || user.email,
      is_admin: isAdmin,
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setText("");
    void load();
  };

  const encerrar = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "encerrado", closed_by: user.id, closed_at: new Date().toISOString() })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Não foi possível encerrar o chamado.");
      return;
    }
    toast.success("Chamado encerrado.");
    onClosed?.();
  };

  const encerrado = ticket.status !== "aberto";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary/60" aria-label="Voltar">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ticket.category}
            {isAdmin && ticket.user_email ? ` · ${ticket.user_email}` : ""}
          </p>
        </div>
        {!encerrado && (
          <Button size="sm" variant="outline" onClick={encerrar}>
            Encerrar
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-auto p-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma mensagem ainda.</p>
        )}
        {messages.map((m) => {
          const mine = m.is_admin === isAdmin;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                <p className="mb-0.5 text-[10px] opacity-70">{m.author_name}</p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {encerrado ? (
        <p className="border-t border-border/60 p-3 text-center text-xs text-muted-foreground">
          Chamado encerrado.
        </p>
      ) : (
        <div className="flex items-end gap-2 border-t border-border/60 p-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Escreva sua mensagem..."
            className="min-h-[44px] resize-none"
          />
          <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SupportWidget() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [active, setActive] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORIAS[0]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, category, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "aberto")
      .order("updated_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!isAuthenticated || !user) return null;

  const criar = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        subject: subject.trim(),
        category,
      })
      .select("id, subject, category, status, created_at")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error("Não foi possível abrir o chamado.");
      return;
    }

    await supabase.from("support_messages").insert({
      ticket_id: data.id,
      author_id: user.id,
      author_name: user.name || user.email,
      is_admin: false,
      body: message.trim(),
    });

    setSaving(false);
    setSubject("");
    setMessage("");
    setCreating(false);
    setActive(data as Ticket);
    void load();
    toast.success("Chamado aberto!");
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[460px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-2">
          {active ? (
            <TicketThread
              ticket={active}
              isAdmin={false}
              onClose={() => {
                setActive(null);
                void load();
              }}
              onClosed={() => {
                setActive(null);
                void load();
              }}
            />
          ) : creating ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                <button onClick={() => setCreating(false)} className="rounded-md p-1 hover:bg-secondary/60" aria-label="Voltar">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold">Novo chamado</p>
              </div>
              <div className="flex-1 space-y-3 overflow-auto p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Assunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} />
                </div>
              </div>
              <div className="border-t border-border/60 p-3">
                <Button className="w-full" onClick={criar} disabled={saving || !subject.trim() || !message.trim()}>
                  {saving ? "Enviando..." : "Enviar chamado"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                  <Headphones className="h-4 w-4 text-primary-foreground" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Suporte MonkeyLab</p>
                  <p className="text-[11px] text-muted-foreground">Atendimento pelo sistema</p>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-secondary/60" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <Button className="w-full" onClick={() => setCreating(true)}>
                  <Plus className="mr-1.5 h-4 w-4" /> Abrir novo chamado
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://wa.me/5581992120805"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#25D366]/15 px-2.5 py-2 text-[11px] font-semibold text-[#25D366] ring-1 ring-[#25D366]/30 transition-colors hover:bg-[#25D366]/25"
                  >
                    <Phone className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                  <a
                    href="https://chat.whatsapp.com/F8T3ASBFINeEFE2swOcUeQ?mode=gi_t"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary/15 px-2.5 py-2 text-[11px] font-semibold text-primary ring-1 ring-primary/30 transition-colors hover:bg-primary/25"
                  >
                    <Users className="h-3.5 w-3.5" /> Comunidade
                  </a>
                </div>
              </div>
              <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground">Meus chamados</p>
              <div className="flex-1 space-y-2 overflow-auto p-3">
                {tickets.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">Você ainda não tem chamados.</p>
                )}
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActive(t)}
                    className="w-full rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:bg-secondary/60"
                  >
                    <p className="truncate text-sm font-medium">{t.subject}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Suporte"
        className="flex h-14 w-14 items-center justify-center rounded-full gradient-primary shadow-[0_10px_30px_-8px_hsl(var(--primary)/0.8)] transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6 text-primary-foreground" /> : <MessageCircle className="h-7 w-7 text-primary-foreground" />}
      </button>
    </div>
  );
}
