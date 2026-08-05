import { ChevronDown, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Bloco recolhível para os campos técnicos das faturas (impostos, códigos,
 * protocolos). O cliente não precisa abrir: tudo é gerado automaticamente.
 */
export function AutoSection({
  title,
  description,
  onRandomize,
  children,
}: {
  title: string;
  description?: string;
  onRandomize?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <details className="glass group rounded-xl p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="flex-1 text-sm font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
          Automático
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          {description ??
            "Estes valores são calculados sozinhos a partir do total da fatura. Só abra se quiser conferir ou ajustar manualmente."}
        </p>

        {onRandomize && (
          <Button type="button" variant="outline" size="sm" onClick={onRandomize}>
            <Wand2 className="mr-2 h-4 w-4" /> Gerar aleatório
          </Button>
        )}

        {children && <div className="grid gap-4 sm:grid-cols-2">{children}</div>}
      </div>
    </details>
  );
}

export default AutoSection;
