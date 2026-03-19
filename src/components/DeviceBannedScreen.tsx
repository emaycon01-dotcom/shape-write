import { ShieldOff } from "lucide-react";

export default function DeviceBannedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <ShieldOff className="w-10 h-10 text-destructive" />
        </div>

        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Acesso Bloqueado
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Este dispositivo foi permanentemente bloqueado por violação das políticas de segurança do sistema.
          </p>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground space-y-2">
          <p>
            Atividades suspeitas foram detectadas neste dispositivo. Por medida de segurança, 
            o acesso ao painel foi revogado permanentemente.
          </p>
          <p className="font-medium text-destructive">
            Criar novas contas neste dispositivo não restaurará o acesso.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Código do dispositivo registrado. Qualquer tentativa adicional será documentada.
        </p>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            © 2026 Bellarus Sistemas — Segurança ativa
          </p>
        </div>
      </div>
    </div>
  );
}
