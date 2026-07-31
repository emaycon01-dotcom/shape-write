import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments, isDocumentExpired, daysUntilExpiry } from "@/contexts/DocumentContext";
import { DOCUMENT_TYPE_LABELS } from "@/lib/document-routes";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.webp";
import {
  Crown, ArrowUpRight, FileText, CreditCard, Gem, Star, Rocket,
  ShieldCheck, Zap, Clock, History,

} from "lucide-react";




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
  const { documents } = useDocuments();

  const isAdmin = user?.role === "admin";

  const userDocs = useMemo(
    () => documents.filter((d) => d.userId === user?.id),
    [documents, user?.id]
  );

  const recentes = useMemo(() => userDocs.slice(0, 4), [userDocs]);







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




      {/* Planos */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">Planos</h2>
            <p className="text-[11px] text-muted-foreground">Descontos em todo o sistema</p>
          </div>
          <Link to="/dashboard/planos" className="text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline">
            Ver planos
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLANOS.map((p) => (
            <Link
              key={p.nome}
              to={`/dashboard/planos?plano=${encodeURIComponent(p.nome)}`}
              className={`group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 ring-1 ${p.ring} backdrop-blur transition-all hover:-translate-y-0.5`}
            >
              <div className={`absolute inset-0 ${p.gradient} opacity-[0.14]`} />
              <div className="relative flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border/60">
                  <p.icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{p.preco}</p>
                </div>
              </div>
              <p className="relative mt-2.5 inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-wide text-foreground">
                <Zap className="h-2.5 w-2.5" /> {p.desconto}% de desconto
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Últimos documentos */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-foreground">Últimos documentos</h2>
            <p className="text-[11px] text-muted-foreground">Gerados recentemente na sua conta</p>
          </div>
          <Link to="/dashboard/historico" className="text-[10px] font-semibold uppercase tracking-wide text-primary hover:underline">
            Histórico
          </Link>
        </div>

        {recentes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-card/40 p-6 text-center">
            <History className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Nenhum documento gerado ainda.</p>
            <Link to="/dashboard/documents" className="text-[11px] font-semibold text-primary hover:underline">
              Gerar meu primeiro documento
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentes.map((d) => {
              const expirado = isDocumentExpired(d);
              return (
                <Link
                  key={d.id}
                  to="/dashboard/historico"
                  className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border/60">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">
                      {DOCUMENT_TYPE_LABELS[d.type] || d.type}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{d.name || "—"}</p>
                  </div>
                  <span
                    className={`rounded-md border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide ${
                      expirado
                        ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : "border-success/40 bg-success/15 text-success"
                    }`}
                  >
                    {expirado ? "Expirado" : `${daysUntilExpiry(d)}d`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Rodapé */}
      <footer className="flex items-center justify-center pt-2 pb-4">
        <img src={logo} alt="MonkeyLab" className="h-8 w-auto object-contain opacity-70" />
      </footer>

    </div>

  );
}


