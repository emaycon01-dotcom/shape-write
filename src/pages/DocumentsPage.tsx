import { useNavigate } from "react-router-dom";
import { FileText, Smartphone, Phone, Home, FlaskConical, CreditCard, Stethoscope, FileCheck, Wrench } from "lucide-react";

interface DocItem {
  id: string;
  name: string;
  description: string;
  credits: number;
  route: string;
  icon: React.ElementType;
}

interface DocCategory {
  id: string;
  name: string;
  emoji: string;
  icon: React.ElementType;
  items: DocItem[];
}

const categories: DocCategory[] = [
  {
    id: "celulares",
    name: "SERVIÇOS CELULARES",
    emoji: "📱",
    icon: Smartphone,
    items: [
      { id: "recargas", name: "Recarga Celular", description: "Recarga Claro, Vivo ou TIM com 50% de desconto", credits: 0.5, route: "/dashboard/documents/recargas", icon: Phone },
      { id: "esim", name: "Chip Virtual (eSIM)", description: "E-SIM Vivo ou Claro com DDD aleatório ou específico", credits: 1.3, route: "/dashboard/documents/esim", icon: Smartphone },
    ],
  },
  {
    id: "documentos",
    name: "DOCUMENTOS DIGITAIS",
    emoji: "🪪",
    icon: FileText,
    items: [
      { id: "cnh", name: "CNH Digital (2026)", description: "CNH Digital com login, APK e QR Code", credits: 1, route: "/dashboard/documents/cnh", icon: FileText },
      { id: "cha-amador", name: "CHÁ Amador Digital", description: "Carteira de Habilitação de Amador com foto e dados", credits: 1, route: "/dashboard/documents/cha-amador", icon: FileText },
      { id: "rg", name: "CIN (RG Digital)", description: "Carteira de Identidade Nacional", credits: 1, route: "", icon: FileText },
      { id: "historico-escolar", name: "Histórico Escolar", description: "Histórico escolar digital com preenchimento automático", credits: 1, route: "/dashboard/documents/historico-escolar", icon: FileText },
      { id: "declaracao-escolar", name: "Declaração Escolar", description: "Declaração de conclusão escolar com preenchimento automático", credits: 1, route: "/dashboard/documents/declaracao-escolar", icon: FileText },
    ],
  },
  {
    id: "comprovantes",
    name: "COMPROVANTES",
    emoji: "📄",
    icon: FileCheck,
    items: [
      { id: "comprovante", name: "Comprovante de Residência", description: "Comprovante de residência digital com preenchimento automático", credits: 1, route: "/dashboard/documents/comprovante-residencia", icon: Home },
      { id: "comprovante-renda", name: "Comprovante de Renda", description: "Comprovante de renda digital personalizado", credits: 1, route: "", icon: FileCheck },
      { id: "comprovante-pagamento", name: "Comprovante de Pagamento", description: "Comprovante de pagamento digital", credits: 1, route: "", icon: CreditCard },
    ],
  },
  {
    id: "escolares",
    name: "ESCOLARES",
    emoji: "🎓",
    icon: FileText,
    items: [
      { id: "certificado-escolar", name: "Certificado Escolar", description: "Certificado escolar digital personalizado", credits: 1, route: "", icon: FileText },
      { id: "conclusao-escolar", name: "Conclusão Escolar", description: "Conclusão escolar digital personalizada", credits: 1, route: "", icon: FileText },
    ],
  },
  {
    id: "medicos",
    name: "MÉDICOS E EXAMES",
    emoji: "🧑‍⚕️",
    icon: Stethoscope,
    items: [
      { id: "exame-toxico", name: "Exame Toxicológico", description: "Exame toxicológico digital com preenchimento automático", credits: 1, route: "/dashboard/documents/exame-toxicologico", icon: FlaskConical },
      { id: "atestado", name: "Atestado Médico", description: "Atestado médico digital personalizado", credits: 1, route: "", icon: Stethoscope },
      { id: "receita", name: "Receita Médica", description: "Receita médica digital personalizada", credits: 1, route: "", icon: Stethoscope },
    ],
  },
];

export default function DocumentsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Módulos de Documentos</h1>
      <p className="text-muted-foreground mb-8">Escolha um serviço para começar</p>

      <div className="space-y-10">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg shrink-0">
                {cat.emoji}
              </div>
              <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {cat.name}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.items.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => dt.route && navigate(dt.route)}
                  className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group disabled:opacity-50"
                  disabled={!dt.route}
                >
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    {dt.route ? (
                      <dt.icon className="w-6 h-6 text-primary" />
                    ) : (
                      <Wrench className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-1">{dt.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{dt.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-accent font-medium">{dt.credits} Crédito{dt.credits !== 1 ? "s" : ""}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${dt.route ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                      {!dt.route && <Wrench className="w-3 h-3" />}
                      {dt.route ? "ATIVO" : "EM BREVE"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
