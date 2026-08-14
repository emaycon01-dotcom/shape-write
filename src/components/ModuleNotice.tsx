import { AlertTriangle } from "lucide-react";

interface ModuleNoticeProps {
  title?: string;
  description?: string;
}

/** Aviso destacado exibido no topo de módulos com funcionalidade parcial. */
export function ModuleNotice({
  title = "APENAS O QR CODE ESTÁ FUNCIONANDO",
  description = "O APK e o site estão em manutenção.",
}: ModuleNoticeProps) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default ModuleNotice;
