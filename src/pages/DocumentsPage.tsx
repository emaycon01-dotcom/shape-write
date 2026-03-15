import { useNavigate } from "react-router-dom";
import { FileText, Smartphone, Phone } from "lucide-react";

const docTypes = [
  { id: "cnh", name: "CNH Digital (2024)", description: "CNH Digital com login, APK e QR Code", credits: 1, route: "/dashboard/documents/cnh", icon: FileText },
  { id: "esim", name: "E-SIM Digital", description: "E-SIM Vivo ou Claro com DDD aleatório ou específico", credits: 1.3, route: "/dashboard/documents/esim", icon: Smartphone },
  { id: "recargas", name: "Recargas", description: "Recarga Claro, Vivo ou TIM com 50% de desconto", credits: 0.5, route: "/dashboard/documents/recargas", icon: Phone },
  { id: "rg", name: "CIN (RG Digital)", description: "Carteira de Identidade Nacional", credits: 1, route: "", icon: FileText },
  { id: "certificado", name: "Certificado", description: "Certificado digital personalizado", credits: 1, route: "", icon: FileText },
];

export default function DocumentsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Módulos de Documentos</h1>
      <p className="text-muted-foreground mb-8">Escolha um serviço para começar</p>

      <p className="text-xs text-muted-foreground tracking-widest mb-4">DOCUMENTOS DIGITAIS</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docTypes.map((dt) => (
          <button
            key={dt.id}
            onClick={() => dt.route && navigate(dt.route)}
            className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group disabled:opacity-50"
            disabled={!dt.route}
          >
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <dt.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-1">{dt.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{dt.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-success font-medium">{dt.credits} Crédito</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">{dt.route ? "ATIVO" : "EM BREVE"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
