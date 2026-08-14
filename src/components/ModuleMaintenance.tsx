import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wrench, ArrowLeft } from "lucide-react";

interface ModuleMaintenanceProps {
  title?: string;
  description?: string;
}

export function ModuleMaintenance({
  title = "Módulo em manutenção",
  description = "Este serviço está temporariamente indisponível enquanto ajustamos os últimos detalhes. Volte em breve.",
}: ModuleMaintenanceProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-5 py-20 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-warning/15 ring-1 ring-warning/40">
        <Wrench className="h-9 w-9 text-warning" />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 animate-pulse rounded-full bg-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" onClick={() => navigate("/dashboard/documents")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos serviços
      </Button>
    </div>
  );
}
