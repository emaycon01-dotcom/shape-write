import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, TrendingUp, Smartphone, Coins } from "lucide-react";

interface RechargeLog {
  id: string;
  amount: number;
  credits_used: number;
  created_at: string;
}

export default function AdminReparticaoPage() {
  const [logs, setLogs] = useState<RechargeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("recharge_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) setLogs(data as any);
      setLoading(false);
    };
    fetch();
  }, []);

  const totalRecharges = logs.length;
  const totalValue = logs.reduce((s, l) => s + Number(l.amount), 0);
  const totalCredits = logs.reduce((s, l) => s + Number(l.credits_used), 0);

  // Profit calculation: total value / 2 = credits equivalent, credits * 0.20 = profit
  const creditEquivalent = totalValue / 2;
  const profit = creditEquivalent * 0.20;

  const stats = [
    { label: "TOTAL RECARGAS", value: totalRecharges, icon: Smartphone, color: "text-primary" },
    { label: "VALOR TOTAL", value: `R$ ${totalValue.toFixed(2)}`, icon: Coins, color: "text-success" },
    { label: "CRÉDITOS USADOS", value: totalCredits, icon: Calculator, color: "text-accent" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="w-5 h-5 text-muted-foreground" />
            <h1 className="font-display text-2xl font-bold text-foreground">Repartição de Equipe</h1>
          </div>
          <p className="text-sm text-muted-foreground">Dados de recargas e cálculo automático de lucro</p>
        </div>
        <div className="glass rounded-xl px-6 py-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-success" />
          <div>
            <p className="text-[10px] tracking-widest text-muted-foreground">TOTAL VENDAS RECARGA</p>
            <p className="text-xl font-bold text-foreground">R$ {totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Profit Card */}
      <div className="glass rounded-xl p-6 border border-success/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-success" />
          <h2 className="text-sm font-semibold text-foreground tracking-wider">LUCROS GO G7 GERENTE</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Valor Total Recargas</p>
            <p className="text-lg font-bold text-foreground">R$ {totalValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Créditos Equivalentes (÷2)</p>
            <p className="text-lg font-bold text-foreground">{creditEquivalent.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Lucro Calculado</p>
            <p className="text-lg font-bold text-success">R$ {profit.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando dados...</div>
      )}
    </div>
  );
}
