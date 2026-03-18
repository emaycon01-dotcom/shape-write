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
  BarChart3,
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

  const stats = [
    { label: "CRÉDITOS", value: user?.credits ?? 0, icon: Zap, color: "text-accent" },
    { label: "TRANSFERÊNCIA", value: 0, icon: Send, color: "text-primary" },
    { label: "HOJE", value: userDocs.filter(d => d.createdAt.startsWith(new Date().toISOString().split("T")[0])).length, icon: CalendarDays, color: "text-success" },
    { label: "EQUIPE", value: isAdmin ? 2 : 0, icon: Users, color: "text-accent" },
  ];

  const shortcuts = isAdmin
    ? [
        { title: "Serviços", desc: "Gerar documentos", icon: FileText, url: "/dashboard/documents", color: "text-primary" },
        { title: "Histórico", desc: "Serviços gerados", icon: History, url: "/dashboard/history", color: "text-yellow-400" },
        { title: "Revendedores", desc: "Gerenciar equipe", icon: Users, url: "/dashboard/revendedores", color: "text-success" },
        { title: "Usuários", desc: "Gerenciar usuários", icon: Users, url: "/dashboard/admin/usuarios", color: "text-accent" },
        { title: "Financeiro", desc: "Depósitos e lucro", icon: CreditCard, url: "/dashboard/admin/financeiro", color: "text-success" },
        { title: "Recarregar", desc: "Comprar créditos", icon: CreditCard, url: "/dashboard/recarregar", color: "text-primary" },
      ]
    : [
        { title: "Serviços", desc: "Gerar documentos", icon: FileText, url: "/dashboard/documents", color: "text-primary" },
        { title: "Histórico", desc: "Serviços gerados", icon: History, url: "/dashboard/history", color: "text-yellow-400" },
        { title: "Recarregar", desc: "Comprar créditos", icon: CreditCard, url: "/dashboard/recarregar", color: "text-primary" },
        { title: "Planos", desc: "Planos exclusivos", icon: Crown, url: "/dashboard/planos", color: "text-accent" },
      ];

  // Metas mockadas
  const metas = [
    { label: "DIÁRIA", current: userDocs.filter(d => d.createdAt.startsWith(new Date().toISOString().split("T")[0])).length, total: 3 },
    { label: "SEMANAL", current: Math.min(userDocs.length, 10), total: 10 },
    { label: "MENSAL", current: Math.min(userDocs.length, 30), total: 30 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Olá, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm">{formatDate()}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-foreground">
          <Crown className="w-3.5 h-3.5 text-accent" />
          {isAdmin ? "Admin" : "Cliente"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-[10px] tracking-widest text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Metas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <h2 className="text-sm font-semibold text-foreground tracking-wider">METAS</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {metas.map((m) => {
            const pct = m.total > 0 ? Math.round((m.current / m.total) * 100) : 0;
            return (
              <div key={m.label} className="glass rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground tracking-wider">{m.label}</span>
                  <span className="text-sm font-bold text-primary">{m.current}/{m.total}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground mt-2">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atalhos */}
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-wider mb-4">ATALHOS</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {shortcuts.map((s) => (
            <Link
              key={s.title}
              to={s.url}
              className="glass rounded-xl p-5 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
