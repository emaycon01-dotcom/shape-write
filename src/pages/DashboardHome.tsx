import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { User, CreditCard, Crown, FileText } from "lucide-react";

const cardConfig = [
  { key: "user", label: "USUÁRIO", icon: User, color: "bg-success", getValue: (u: any) => u.name },
  { key: "credits", label: "CRÉDITOS DISPONÍVEIS", icon: CreditCard, color: "bg-primary", getValue: (u: any) => u.credits },
  { key: "plan", label: "PLANO ATUAL", icon: Crown, color: "bg-accent", getValue: (u: any) => u.role === "admin" ? "Admin" : "Cliente" },
  { key: "docs", label: "DOCUMENTOS CRIADOS", icon: FileText, color: "bg-accent", getValue: () => null },
];

const topColors = ["border-t-primary", "border-t-success", "border-t-accent", "border-t-accent"];

export default function DashboardHome() {
  const { user } = useAuth();
  const { documents } = useDocuments();
  const userDocs = documents.filter((d) => d.userId === user?.id);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Painel Principal</h1>
      <p className="text-muted-foreground mb-8">Bem-vindo ao BELLARUS SISTEMAS</p>

      <div className="grid md:grid-cols-2 gap-6">
        {cardConfig.map((c, i) => (
          <div
            key={c.key}
            className={`glass rounded-xl p-6 border-t-2 ${topColors[i]}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg ${c.color} flex items-center justify-center`}>
                <c.icon className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground tracking-wider">{c.label}</p>
                <p className="text-xl font-bold text-foreground">
                  {c.key === "docs" ? userDocs.length : c.getValue(user)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
