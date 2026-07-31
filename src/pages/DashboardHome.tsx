import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments, isDocumentExpired, daysUntilExpiry } from "@/contexts/DocumentContext";
import { DOCUMENT_TYPE_LABELS } from "@/lib/document-routes";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import {
  Crown, ArrowUpRight, FileText, CreditCard, Gem, Star, Rocket,
  ShieldCheck, Zap, Clock, Car, IdCard, Stethoscope, Anchor,
  Layers, History, AlertTriangle, PenTool, MessageCircle, Users,
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

const MODULOS_RAPIDOS = [
  { titulo: "CNH Digital", icon: FileText, rota: "/dashboard/documents/cnh" },
  { titulo: "RG Digital", icon: IdCard, rota: "/dashboard/documents/rg" },
  { titulo: "CRLV Digital", icon: Car, rota: "/dashboard/documents/crlv" },
  { titulo: "CNH Marítima", icon: Anchor, rota: "/dashboard/documents/cha" },
  { titulo: "Atestado", icon: Stethoscope, rota: "/dashboard/documents/atestado" },
  { titulo: "Assinaturas", icon: PenTool, rota: "/dashboard/ferramentas/assinaturas" },
];

function Stat({ icon: Icon, label, value, tone = "text-primary" }: {
  icon: React.ElementType; label: string; value: React.ReactNode; tone?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border/60">
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="font-display text-base font-bold leading-tight text-foreground">{value}</p>
        </div>
      </div>
    </div>
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
  const ativos = useMemo(() => userDocs.filter((d) => !isDocumentExpired(d)), [userDocs]);
  const expirando = useMemo(
    () => ativos.filter((d) => daysUntilExpiry(d) <= 7).length,
    [ativos]
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




      {/* Rodapé */}
      <footer className="flex items-center justify-center pt-2 pb-4">
        <img src={logo} alt="MonkeyLab" className="h-8 w-auto object-contain opacity-70" />
      </footer>
    </div>

  );
}


