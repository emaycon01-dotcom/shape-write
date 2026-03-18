import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp } from "lucide-react";

interface Deposit {
  id: string;
  user_name: string;
  user_email: string;
  amount: number;
  method: string;
  created_at: string;
}

export default function AdminFinanceiroPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchDeposits = async () => {
      const { data } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (data) {
        const deps = data as any as Deposit[];
        setDeposits(deps);
        setTotal(deps.reduce((sum, d) => sum + Number(d.amount), 0));
      }
      setLoading(false);
    };
    fetchDeposits();

    const channel = supabase
      .channel("deposits-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deposits" }, (payload) => {
        const row = payload.new as any as Deposit;
        setDeposits((prev) => [row, ...prev]);
        setTotal((prev) => prev + Number(row.amount));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <h1 className="font-display text-2xl font-bold text-foreground">Financeiro</h1>
          </div>
          <p className="text-sm text-muted-foreground">Visão geral e histórico de depósitos</p>
        </div>
        <div className="glass rounded-xl px-6 py-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-success" />
          <div>
            <p className="text-[10px] tracking-widest text-muted-foreground">TOTAL DEPÓSITOS</p>
            <p className="text-xl font-bold text-foreground">R$ {total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-wider mb-4">HISTÓRICO DE DEPÓSITOS</h2>
        {loading ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
        ) : deposits.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">Nenhum depósito registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{d.user_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{d.user_email}</td>
                    <td className="py-3 px-4 text-success font-semibold">R$ {Number(d.amount).toFixed(2)}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium uppercase">{d.method}</span></td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
