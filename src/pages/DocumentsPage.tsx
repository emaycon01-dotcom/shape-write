import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";

export default function DocumentsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Serviços</h1>
      <p className="text-muted-foreground mb-8">Escolha um serviço para começar</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => navigate("/dashboard/documents/cnh")}
          className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group"
        >
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground mb-1">CNH Digital (2026)</h3>
          <p className="text-sm text-muted-foreground mb-3">CNH Digital com login, APK e QR Code</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-accent font-medium">1 Crédito</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">ATIVO</span>
          </div>
        </button>
      </div>
    </div>
  );
}
