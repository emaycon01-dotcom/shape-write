import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Crown, ArrowUpRight, Sparkle, FileText, CreditCard, Gem, Star, Rocket } from "lucide-react";

const PLANOS = [
  {
    nome: "Dealer",
    preco: "R$ 150,00",
    icon: Rocket,
    destaque: false,
    beneficios: ["Acesso ao painel de serviços", "Geração de CNH Digital", "Suporte padrão"],
  },
  {
    nome: "Master",
    preco: "R$ 450,00",
    icon: Star,
    destaque: true,
    beneficios: ["Tudo do Dealer", "Prioridade na geração", "Suporte prioritário"],
  },
  {
    nome: "Diamond",
    preco: "R$ 999,99",
    icon: Gem,
    destaque: false,
    beneficios: ["Tudo do Master", "Limites ampliados", "Atendimento dedicado"],
  },
];


const formatDate = () => {
  const d = new Date();
  const days = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-7">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 p-6 sm:p-8 shadow-[0_24px_60px_-30px_hsl(var(--accent)/0.55),inset_0_1px_0_hsl(var(--foreground)/0.07)]">
        <div className="absolute inset-0 gradient-primary opacity-[0.14]" />
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-accent/25 blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-28 -left-10 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full gradient-button px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground shadow-[0_8px_20px_-8px_hsl(var(--accent)/0.8)]">
                <Crown className="w-3.5 h-3.5" />
                {isAdmin ? "Administrador" : "Cliente"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                <Sparkle className="w-3.5 h-3.5 text-accent" />
                Conta ativa
              </span>
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
                Olá, {user?.name?.split(" ")[0]}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 capitalize">{formatDate()}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="rounded-2xl border border-border/60 bg-card/70 px-5 py-4 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
              <p className="text-[10px] tracking-[0.2em] text-muted-foreground">SALDO</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {user?.credits ?? 0} <span className="text-sm font-medium text-muted-foreground">créditos</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Serviços + Recarga */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/dashboard/documents"
          className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-card/80 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 shadow-[0_18px_45px_-25px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08)]"
        >
          <div className="absolute inset-0 gradient-primary opacity-[0.12]" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-primary/40">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground">Serviços</p>
              <p className="text-xs text-muted-foreground">Gerar CNH Digital</p>
            </div>
            <ArrowUpRight className="w-5 h-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </div>
        </Link>

        <Link
          to="/dashboard/recarregar"
          className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]"
        >
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-accent/40">
              <CreditCard className="w-6 h-6 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground">Recarga</p>
              <p className="text-xs text-muted-foreground">Adicionar créditos</p>
            </div>
            <ArrowUpRight className="w-5 h-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-accent" />
          </div>
        </Link>
      </section>

      {/* Planos */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-accent" />
          <h2 className="font-display text-lg font-bold text-foreground">Planos</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANOS.map((plano) => (
            <div
              key={plano.nome}
              className={`group relative overflow-hidden rounded-2xl border p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 ${
                plano.destaque
                  ? "border-accent/50 bg-card/80 shadow-[0_22px_50px_-28px_hsl(var(--accent)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.09)]"
                  : "border-border/60 bg-card/60 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]"
              }`}
            >
              {plano.destaque && (
                <>
                  <div className="absolute inset-0 gradient-primary opacity-[0.12]" />
                  <span className="absolute right-4 top-4 rounded-full gradient-button px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    POPULAR
                  </span>
                </>
              )}
              <div className="relative space-y-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/60">
                  <plano.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-foreground">{plano.nome}</p>
                  <p className="font-display text-2xl font-bold text-accent">{plano.preco}</p>
                </div>
                <ul className="space-y-1.5">
                  {plano.beneficios.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Sparkle className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard/recarregar"
                  className={`flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                    plano.destaque
                      ? "gradient-button text-primary-foreground hover:opacity-90"
                      : "border border-border/70 text-foreground hover:bg-secondary/60"
                  }`}
                >
                  Assinar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
