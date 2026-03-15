import { useState } from "react";
import { Users, Search, Crown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Reseller {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: "ativo" | "inativo";
  credits: number;
}

const mockResellers: Reseller[] = [
  { id: "1", name: "kroniel85", email: "kroniel85@gmail.com", plan: "Master", status: "ativo", credits: 3 },
  { id: "2", name: "Forex", email: "forex@email.com", plan: "Dealer", status: "ativo", credits: 5 },
  { id: "3", name: "João Silva", email: "joao@email.com", plan: "Diamont", status: "inativo", credits: 0 },
];

export default function RevendedoresPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ativos" | "inativos">("ativos");

  const filtered = mockResellers.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === "ativos" ? r.status === "ativo" : r.status === "inativo";
    return matchSearch && matchTab;
  });

  const activeCount = mockResellers.filter((r) => r.status === "ativo").length;
  const inactiveCount = mockResellers.filter((r) => r.status === "inativo").length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-success" />
            <h1 className="font-display text-2xl font-bold text-foreground">Revendedores</h1>
          </div>
          <p className="text-sm text-muted-foreground">Gerencie sua equipe de revendedores</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-border">
        <button
          onClick={() => setTab("ativos")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            tab === "ativos" ? "bg-success text-success-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Users className="w-4 h-4" /> Ativos
          <span className="text-xs font-bold">{activeCount}</span>
        </button>
        <button
          onClick={() => setTab("inativos")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            tab === "inativos" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Users className="w-4 h-4" /> Inativos
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === "inativos" ? "" : "bg-destructive text-destructive-foreground"}`}>
            {inactiveCount}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar revendedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revendedor</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                    <Crown className="w-3 h-3" /> {r.plan}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === "ativo" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                  }`}>
                    {r.status}
                  </span>
                </TableCell>
                <TableCell className="text-right text-foreground">{r.credits} cr</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum revendedor encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
