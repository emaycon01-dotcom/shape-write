import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Link } from "react-router-dom";
import {
  Zap,
  Send,
  CalendarDays,
  Users,
  FileText,
  History,
  CreditCard,
  Crown,
  ArrowUpRight,
  Sparkle,
  ShieldCheck,
  Headphones,
} from "lucide-react";

const formatDate = () => {
  const d = new Date();
  const days = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const { documents } = useDocuments();
  const userDocs = documents.filter((d) => d.userId === user?.id);
  const isAdmin = user?.role === "admin";
  const today = new Date().toISOString().split("T")[0];

  const stats = [
    { label: "Créditos", value: user?.credits ?? 0, icon: Zap, tone: "accent" as const },
    { label: "Transferência", value: 0, icon: Send, tone: "primary" as const },
    { label: "Hoje", value: userDocs.filter((d) => d.createdAt.startsWith(today)).length, icon: CalendarDays, tone: "success" as const },
    { label: "Equipe", value: isAdmin ? 2 : 0, icon: Users, tone: "primary" as const },
  ];

  const shortcuts = isAdmin
    ? [
        { title: "Serviços", desc: "Gerar documentos", icon: FileText, url: "/dashboard/documents", featured: true },
        { title: "Histórico", desc: "Serviços gerados", icon: History, url: "/dashboard/history" },
        { title: "Revendedores", desc: "Gerenciar equipe", icon: Users, url: "/dashboard/revendedores" },
        { title: "Usuários", desc: "Gerenciar usuários", icon: ShieldCheck, url: "/dashboard/admin/usuarios" },
        { title: "Financeiro", desc: "Depósitos e lucro", icon: CreditCard, url: "/dashboard/admin/financeiro" },
        { title: "Recarregar", desc: "Comprar créditos", icon: Zap, url: "/dashboard/recarregar" },
      ]
    : [
        { title: "Serviços", desc: "Gerar documentos", icon: FileText, url: "/dashboard/documents", featured: true },
        { title: "Histórico", desc: "Serviços gerados", icon: History, url: "/dashboard/history" },
        { title: "Recarregar", desc: "Comprar créditos", icon: CreditCard, url: "/dashboard/recarregar" },
        { title: "Planos", desc: "Planos exclusivos", icon: Crown, url: "/dashboard/planos" },
      ];

  const toneRing: Record<string, string> = {
    accent: "text-accent bg-accent/10 ring-accent/20",
    primary: "text-primary bg-primary/10 ring-primary/20",
    success: "text-success bg-success/10 ring-success/20",
  };

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
            <Link
              to="/dashboard/recarregar"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl gradient-button px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_-12px_hsl(var(--accent)/0.9)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              Recarregar <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]"
          >
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneRing[s.tone]}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </section>

      {/* Atalhos */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-foreground">ATALHOS</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {shortcuts.map((s) => (
            <Link
              key={s.title}
              to={s.url}
              className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 ${
                s.featured
                  ? "border-primary/40 bg-card/80 shadow-[0_18px_45px_-25px_hsl(var(--primary)/0.9),inset_0_1px_0_hsl(var(--foreground)/0.08)]"
                  : "border-border/60 bg-card/60 hover:border-primary/30 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]"
              } backdrop-blur`}
            >
              {s.featured && <div className="absolute inset-0 gradient-primary opacity-[0.12]" />}
              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/80 ring-1 ring-border/60 transition-colors group-hover:ring-primary/40">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Suporte */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 p-5 sm:p-6 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
        <div className="absolute inset-0 gradient-primary opacity-[0.08]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/20">
              <Headphones className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Precisa de ajuda?</p>
              <p className="text-xs text-muted-foreground">Nosso suporte responde rápido no seu horário.</p>
            </div>
          </div>
          <Link
            to="/dashboard/documents"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card/70 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            Começar agora <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
