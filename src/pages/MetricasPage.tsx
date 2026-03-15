import { BarChart3, TrendingUp, CreditCard, Users, DollarSign } from "lucide-react";

const stats = [
  { label: "Receita Total", value: "R$ 12.450,00", icon: DollarSign, color: "text-success", change: "+12%" },
  { label: "Créditos Vendidos", value: "1.240", icon: CreditCard, color: "text-primary", change: "+8%" },
  { label: "Usuários Ativos", value: "34", icon: Users, color: "text-accent", change: "+5%" },
  { label: "Ticket Médio", value: "R$ 366,18", icon: TrendingUp, color: "text-yellow-400", change: "+3%" },
];

const recentTransactions = [
  { user: "kroniel85", type: "Recarga", credits: 25, value: "R$ 337,50", date: "14/03/2026" },
  { user: "Forex", type: "Recarga", credits: 10, value: "R$ 140,00", date: "14/03/2026" },
  { user: "Demo", type: "Plano Master", credits: 0, value: "R$ 300,00", date: "13/03/2026" },
  { user: "kroniel85", type: "Recarga", credits: 50, value: "R$ 650,00", date: "12/03/2026" },
  { user: "Admin", type: "Transferência", credits: 100, value: "-", date: "11/03/2026" },
];

export default function MetricasPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Métricas</h1>
        </div>
        <p className="text-sm text-muted-foreground">Visão geral financeira do painel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <span className="text-xs text-success font-semibold">{s.change}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground tracking-wider mt-1">{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Chart placeholder */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground tracking-wider mb-4">RECEITA MENSAL</h2>
        <div className="flex items-end gap-2 h-40">
          {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                style={{ height: `${h}%` }}
              />
              <span className="text-[8px] text-muted-foreground">
                {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground tracking-wider mb-4">TRANSAÇÕES RECENTES</h2>
        <div className="space-y-3">
          {recentTransactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{t.user}</p>
                <p className="text-xs text-muted-foreground">{t.type} {t.credits > 0 && `• ${t.credits} créditos`}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-success">{t.value}</p>
                <p className="text-xs text-muted-foreground">{t.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
