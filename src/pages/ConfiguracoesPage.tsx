import { Settings } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        </div>
        <p className="text-sm text-muted-foreground">Gerencie as configurações do painel</p>
      </div>
      <div className="glass rounded-xl p-8 text-center text-muted-foreground">
        Em breve — configurações do sistema serão adicionadas aqui.
      </div>
    </div>
  );
}
