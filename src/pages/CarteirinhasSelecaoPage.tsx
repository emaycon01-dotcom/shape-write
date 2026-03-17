import { useNavigate } from "react-router-dom";
import { IdCard, Shield, Building2, Landmark } from "lucide-react";

const carteirinhas = [
  {
    id: "bombeiro",
    name: "Carteira de Bombeiro",
    description: "Carteira profissional de Bombeiro Civil com foto e dados completos",
    icon: Shield,
    route: "/dashboard/documentos-fisicos/carteirinhas/bombeiro",
    credits: 1.5,
  },
  {
    id: "porteiro",
    name: "Carteira de Porteiro / Vigia",
    description: "Carteira profissional de Porteiro ou Vigia com registro e foto",
    icon: Building2,
    route: "/dashboard/documentos-fisicos/carteirinhas/porteiro",
    credits: 1.5,
  },
  {
    id: "agente-financeiro",
    name: "Carteira de Agente Financeiro",
    description: "Carteira de Agente Financeiro com dados de formação e registro",
    icon: Landmark,
    route: "/dashboard/documentos-fisicos/carteirinhas/agente-financeiro",
    credits: 1.5,
  },
];

export default function CarteirinhasSelecaoPage() {
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
        <IdCard className="w-7 h-7 text-primary" />
        <h1 className="font-display text-3xl font-bold text-foreground">
          Carteirinhas Físicas e Digitais
        </h1>
      </div>
      <p className="text-muted-foreground mb-8">Escolha o tipo de carteira que deseja gerar</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carteirinhas.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.route)}
            className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group"
          >
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <item.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1">{item.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent font-medium">{item.credits} Créditos</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">ATIVO</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
