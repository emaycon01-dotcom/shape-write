import { Crown, Shield, Star, Zap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    name: "Dealer",
    price: "R$ 120.00",
    badge: null,
    icon: Star,
    iconColor: "text-primary",
    borderColor: "border-t-primary",
    btnClass: "gradient-button",
    benefit: "25% de desconto em todos os documentos",
    discount: 25,
  },
  {
    name: "Master",
    price: "R$ 300.00",
    badge: "POPULAR",
    icon: Shield,
    iconColor: "text-accent",
    borderColor: "border-t-accent",
    btnClass: "bg-accent hover:bg-accent/90",
    benefit: "50% de desconto em todos os documentos",
    discount: 50,
  },
  {
    name: "Diamont",
    price: "R$ 500.00",
    badge: null,
    icon: Crown,
    iconColor: "text-yellow-400",
    borderColor: "border-t-yellow-400",
    btnClass: "bg-yellow-500 hover:bg-yellow-500/90 text-background",
    benefit: "Documentos gratuitos — custo zero!",
    discount: 100,
  },
];

export default function PlanosPage() {
  const { toast } = useToast();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-yellow-500/30 text-yellow-400 text-xs font-semibold tracking-wider">
          <Lock className="w-3.5 h-3.5" />
          PACOTES EXCLUSIVOS DO PAINEL
        </span>
        <h1 className="font-display text-3xl font-bold text-foreground">Planos de Revendedor</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Desbloqueie descontos exclusivos e maximize seus lucros com nossos planos premium
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative glass rounded-xl border-t-2 ${plan.borderColor} p-6 flex flex-col`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" /> {plan.badge}
              </span>
            )}

            <div className={`w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4`}>
              <plan.icon className={`w-6 h-6 ${plan.iconColor}`} />
            </div>

            <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
            <p className="text-2xl font-bold text-foreground mt-1">{plan.price}</p>
            <p className="text-xs text-muted-foreground mb-6">pagamento único</p>

            <div className="flex items-start gap-2 mb-6">
              <Zap className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">{plan.benefit}</p>
            </div>

            <Button
              className={`mt-auto w-full ${plan.btnClass} text-foreground`}
              onClick={() =>
                toast({
                  title: "Plano solicitado",
                  description: `Solicitação do plano ${plan.name} enviada com sucesso.`,
                })
              }
            >
              Selecionar Plano
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Todos os planos são de pagamento único • Acesso imediato após confirmação
      </p>
    </div>
  );
}
