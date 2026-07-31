import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import logo from "@/assets/logo.png";
import {
  Crown, ArrowUpRight, FileText, CreditCard, Gem, Star, Rocket,
  ShieldCheck, Zap, Clock, Check, Percent, Loader2, Copy, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


export const PLANOS = [
  {
    nome: "Dealer",
    preco: "R$ 150,00",
    valor: 150,
    icon: Rocket,
    gradient: "gradient-dealer",
    ring: "ring-sky-500/30",
    desconto: 25,
    descricao:
      "Plano de entrada da MonkeyLab. Libera o painel de serviços e a geração de CNH Digital com suporte padrão. Quem tem o plano Dealer na conta recebe 25% de desconto em todo o sistema.",
    beneficios: ["Painel de serviços", "CNH Digital", "Suporte padrão", "25% de desconto em todo o sistema"],
  },
  {
    nome: "Master",
    preco: "R$ 450,00",
    valor: 450,
    icon: Star,
    gradient: "gradient-master",
    ring: "ring-purple-500/30",
    destaque: true,
    desconto: 50,
    descricao:
      "Plano intermediário com tudo do Dealer, fila prioritária de geração e suporte prioritário. Quem tem o plano Master na conta recebe 50% de desconto em todo o sistema.",
    beneficios: ["Tudo do Dealer", "Fila prioritária", "Suporte prioritário", "50% de desconto em todo o sistema"],
  },
  {
    nome: "Diamond",
    preco: "R$ 999,99",
    valor: 999.99,
    icon: Gem,
    gradient: "gradient-diamond",
    ring: "ring-amber-500/30",
    desconto: 100,
    descricao:
      "Plano máximo da MonkeyLab: tudo do Master, limites ampliados e atendimento dedicado. Quem tem o plano Diamond na conta recebe 100% de desconto em todo o sistema.",
    beneficios: ["Tudo do Master", "Limites ampliados", "Atendimento dedicado", "100% de desconto em todo o sistema"],
  },
];


const formatDate = () => {
  const d = new Date();
  const days = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
};

function Chip({ icon: Icon, children, variant = "outline" }: {
  icon: React.ElementType; children: React.ReactNode; variant?: "solid" | "outline";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide ${
        variant === "solid"
          ? "gradient-button text-primary-foreground shadow-[0_6px_14px_-8px_hsl(var(--accent)/0.9)]"
          : "border border-border/70 bg-card/60 text-muted-foreground backdrop-blur"
      }`}
    >
      <Icon className="h-3 w-3" />
      {children}
    </span>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [planoSelecionado, setPlanoSelecionado] = useState<(typeof PLANOS)[number] | null>(null);



  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 p-5 sm:p-6 shadow-[0_24px_60px_-34px_hsl(var(--accent)/0.6),inset_0_1px_0_hsl(var(--foreground)/0.07)]">
        <div className="absolute inset-0 gradient-primary opacity-[0.13]" />
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/25 blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip icon={Crown} variant="solid">{isAdmin ? "Administrador" : "Cliente"}</Chip>
              <Chip icon={ShieldCheck}>Conta verificada</Chip>
              <Chip icon={Zap}>Geração instantânea</Chip>
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                Olá, {user?.name?.split(" ")[0]}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                <Clock className="h-3 w-3" /> {formatDate()}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-lg border border-border/60 bg-card/70 px-3 py-1.5 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] sm:self-auto">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saldo</span>
            <span className="h-3 w-px bg-border/70" />
            <span className="font-display text-sm font-bold leading-none text-foreground">
              {user?.credits ?? 0}
              <span className="ml-1 text-[10px] font-medium text-muted-foreground">créditos</span>
            </span>
          </div>
        </div>
      </section>

      {/* Atalhos */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/dashboard/documents"
          className="group relative overflow-hidden rounded-xl border border-primary/40 bg-card/80 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 shadow-[0_18px_45px_-30px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08)]"
        >
          <div className="absolute inset-0 gradient-primary opacity-[0.1]" />
          <div className="relative flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-primary/40">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Serviços</p>
              <p className="text-[11px] text-muted-foreground">Gerar CNH Digital</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-primary" />
          </div>
        </Link>

        <Link
          to="/dashboard/recarregar"
          className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]"
        >
          <div className="relative flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-accent/40">
              <CreditCard className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Recarga</p>
              <p className="text-[11px] text-muted-foreground">Adicionar créditos</p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:text-accent" />
          </div>
        </Link>
      </section>

      {/* Planos lado a lado */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-bold text-foreground">Planos</h2>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Pagamento via PIX</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {PLANOS.map((plano) => (
            <div
              key={plano.nome}
              className={`group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/60 p-3 ring-1 ${plano.ring} backdrop-blur transition-all duration-300 hover:-translate-y-1 sm:p-4`}
            >
              <div className={`absolute inset-x-0 top-0 h-[3px] ${plano.gradient}`} />
              <div className={`absolute -right-10 -top-10 h-24 w-24 rounded-full ${plano.gradient} opacity-20 blur-2xl`} />

              <div className="relative flex flex-col gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${plano.gradient} shadow-[0_8px_20px_-12px_hsl(var(--foreground)/0.6)]`}>
                  <plano.icon className="h-4 w-4 text-primary-foreground" />
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className={`inline-flex items-center rounded-md ${plano.gradient} px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wide text-primary-foreground`}>
                      {plano.nome}
                    </span>
                    {plano.destaque && (
                      <span className="inline-flex items-center rounded-md border border-accent/40 bg-accent/10 px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wide text-accent">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="font-display text-base font-bold text-foreground sm:text-lg">{plano.preco}</p>
                </div>

                <ul className="space-y-1">
                  {plano.beneficios.map((b) => (
                    <li key={b} className="flex items-start gap-1 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                      <Check className="mt-[1px] h-3 w-3 shrink-0 text-accent" />
                      {b}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setPlanoSelecionado(plano)}
                  className={`mt-1 flex h-8 w-full items-center justify-center rounded-lg text-[11px] font-semibold text-primary-foreground transition-all hover:opacity-90 ${plano.gradient}`}
                >
                  Assinar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Confirmação de assinatura */}
      <AlertDialog open={!!planoSelecionado} onOpenChange={(o) => !o && setPlanoSelecionado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {planoSelecionado && (
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${planoSelecionado.gradient}`}>
                  <planoSelecionado.icon className="h-4 w-4 text-primary-foreground" />
                </span>
              )}
              Tem certeza que deseja continuar?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  Você está assinando o plano{" "}
                  <span className="font-semibold text-foreground">{planoSelecionado?.nome}</span> por{" "}
                  <span className="font-semibold text-foreground">{planoSelecionado?.preco}</span>.
                </p>
                <p>{planoSelecionado?.descricao}</p>
                <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-accent">
                  <Percent className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold">
                    {planoSelecionado?.desconto}% de desconto em todo o sistema enquanto o plano estiver ativo na conta
                  </span>
                </div>
                <ul className="space-y-1">
                  {planoSelecionado?.beneficios.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-xs">
                      <Check className="mt-[2px] h-3 w-3 shrink-0 text-accent" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                navigate(`/dashboard/recarregar?plano=${encodeURIComponent(planoSelecionado?.nome ?? "")}`)
              }
            >
              Sim, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


