import { useNavigate } from "react-router-dom";
import { IdCard, Shield, Building2, Landmark, Wrench } from "lucide-react";

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
  {
    id: "operador-maquinas",
    name: "Carteira Nacional de Operador de Máquinas Pesadas",
    description: "Carteira profissional de Operador de Máquinas Pesadas física",
    icon: IdCard,
    route: "/dashboard/documentos-fisicos/carteirinhas/operador-maquinas",
    credits: 2,
  },
  {
    id: "operador-maquinas-digital",
    name: "Carteira Nacional de Operador de Máquinas Pesadas (Digital)",
    description: "Versão digital da carteira de Operador de Máquinas Pesadas",
    icon: IdCard,
    route: "",
    credits: 2,
  },
  {
    id: "bombeiro-militar",
    name: "Carteira de Bombeiro Militar",
    description: "Carteira funcional de Bombeiro Militar com dados completos",
    icon: Shield,
    route: "/dashboard/documentos-fisicos/carteirinhas/bombeiro-militar",
    credits: 2,
  },
  {
    id: "identidade-policial-pe",
    name: "Cédula de Identidade Policial (Pernambuco)",
    description: "Cédula de identidade policial do estado de Pernambuco",
    icon: Shield,
    route: "",
    credits: 2,
  },
  {
    id: "cnh-nautica-sp",
    name: "Carteira de CNH Náutica Física (SP)",
    description: "Carteira de habilitação náutica física do estado de São Paulo",
    icon: IdCard,
    route: "",
    credits: 1.5,
  },
  {
    id: "cpf-fisico",
    name: "Carteira de CPF Físico",
    description: "Carteira física do CPF com dados completos",
    icon: IdCard,
    route: "",
    credits: 1,
  },
  {
    id: "seguranca-escolar",
    name: "Carteira de Segurança Escolar",
    description: "Carteira profissional de Segurança Escolar com foto e dados",
    icon: Shield,
    route: "/dashboard/documentos-fisicos/carteirinhas/seguranca-escolar",
    credits: 2,
  },
  {
    id: "porte-federal",
    name: "Carteira de Porte Federal",
    description: "Carteira de Porte Federal com dados completos",
    icon: Shield,
    route: "",
    credits: 2,
  },
  {
    id: "policia-militar-rj",
    name: "Carteira Polícia Militar (RJ)",
    description: "Carteira funcional da Polícia Militar do estado do Rio de Janeiro",
    icon: Shield,
    route: "",
    credits: 2,
  },
  {
    id: "policial-penal",
    name: "Carteira de Policial Penal",
    description: "Carteira funcional de Policial Penal com dados completos",
    icon: Shield,
    route: "",
    credits: 2,
  },
  {
    id: "pericia-criminal",
    name: "Carteira de Perícia Criminal",
    description: "Carteira profissional de Perícia Criminal com registro e foto",
    icon: Shield,
    route: "",
    credits: 2,
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
            onClick={() => item.route && navigate(item.route)}
            className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group disabled:opacity-50"
            disabled={!item.route}
          >
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              {item.route ? (
                <item.icon className="w-6 h-6 text-primary" />
              ) : (
                <Wrench className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1">{item.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-accent font-medium">{item.credits} Crédito{item.credits !== 1 ? "s" : ""}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${item.route ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                {!item.route && <Wrench className="w-3 h-3" />}
                {item.route ? "ATIVO" : "EM BREVE"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
