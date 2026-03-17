import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";

const subModulos = [
  {
    id: "rg-fisico",
    name: "RG Físico",
    description: "Carteira de identidade física (RG) com foto e dados completos",
    credits: 2,
    route: "",
  },
];

export default function RgFisicoSelecaoPage() {
  const navigate = useNavigate();

  return (
    <div>
      <button
        onClick={() => navigate("/dashboard/documents")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
      >
        ← Voltar
      </button>

      <div className="flex items-center gap-3 mb-1">
        <CreditCard className="w-7 h-7 text-primary" />
        <h1 className="font-display text-3xl font-bold text-foreground">
          RG Físico Todos os Estados
        </h1>
      </div>
      <p className="text-muted-foreground mb-8">Escolha o tipo de RG que deseja gerar</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subModulos.map((item) => (
          <button
            key={item.id}
            onClick={() => item.route && navigate(item.route)}
            className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group disabled:opacity-50"
            disabled={!item.route}
          >
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1">{item.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent font-medium">{item.credits} Créditos</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                EM BREVE
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
