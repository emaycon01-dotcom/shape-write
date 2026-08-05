import { useEffect, useState } from "react";
import { Sparkles, X, FileText, Receipt, GraduationCap, Stethoscope, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Atualize a versão sempre que mudar a lista — reabre o aviso para todos. */
const NOVIDADES_VERSION = "2026-08-05";
const STORAGE_KEY = "monkeylab_novidades";

const NOVIDADES = [
  {
    tag: "NOVO SERVIÇO",
    titulo: "SERVIÇOS FINANCEIROS",
    desc: "Nova categoria financeira disponível no catálogo de serviços.",
    icon: Wallet,
  },
  {
    tag: "NOVO SERVIÇO",
    titulo: "SERVIÇOS DE COMPROVANTES",
    desc: "Modelos atualizados com layout de alta resolução e dados automáticos.",
    icon: Receipt,
  },
  {
    tag: "NOVO SERVIÇO",
    titulo: "SERVIÇOS ESCOLARES",
    desc: "Catálogo ampliado com centenas de opções no formulário.",
    icon: GraduationCap,
  },
  {
    tag: "NOVO SERVIÇO",
    titulo: "SERVIÇOS MÉDICOS",
    desc: "Pesquisa completa integrada e validação por QR Code.",
    icon: Stethoscope,
  },
  {
    tag: "MELHORIA",
    titulo: "GERAÇÃO MAIS RÁPIDA",
    desc: "Pré-visualização e arquivo final agora abrem sem espera.",
    icon: FileText,
  },
];

export default function NovidadesDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== NOVIDADES_VERSION) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, NOVIDADES_VERSION);
    } catch {
      /* ignora */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_40px_80px_-40px_hsl(var(--primary)/0.8)]">
        <div className="absolute inset-x-0 top-0 h-[3px] gradient-primary" />

        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg gradient-primary">
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </span>
              Novidades MonkeyLab
            </span>
            <h2 className="font-display text-xl font-bold uppercase text-foreground">O que há de novo</h2>
          </div>
          <button
            onClick={close}
            aria-label="Fechar novidades"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto px-5">
          {NOVIDADES.map((n) => (
            <div
              key={n.titulo}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
                <n.icon className="h-5 w-5 text-primary" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{n.tag}</p>
                <p className="truncate text-sm font-bold text-foreground">{n.titulo}</p>
                <p className="truncate text-[11px] text-muted-foreground">{n.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 pt-4">
          <Button variant="gradient" className="h-12 w-full font-bold" onClick={close}>
            OK, entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
