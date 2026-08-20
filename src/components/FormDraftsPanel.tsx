import { useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  draftAgeLabel,
  draftExpiresInLabel,
  listFormDrafts,
  removeFormDraft,
  type FormDraft,
} from "@/lib/form-drafts";

interface Props {
  /** Identificador do módulo (ex.: "cnh", "certidao"). */
  docType: string;
  /** Aplica os dados do rascunho no formulário da página. */
  onRestore: (data: Record<string, unknown>) => void;
}

/**
 * Painel no topo do formulário com as últimas 3 gerações do usuário
 * (válidas por 2 horas). Um clique em "Restaurar" recarrega todos os
 * campos, evitando redigitar o formulário inteiro.
 */
export default function FormDraftsPanel({ docType, onRestore }: Props) {
  const [drafts, setDrafts] = useState<FormDraft[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setDrafts(listFormDrafts(docType));
  }, [docType]);

  if (drafts.length === 0) return null;

  return (
    <div className="glass space-y-3 p-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-wide text-foreground">
          RETOMAR FORMULÁRIO
        </h3>
        <span className="ml-auto text-[11px] text-muted-foreground">últimas 3 · 2 h</span>
      </div>

      <ul className="space-y-2">
        {drafts.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{d.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {draftAgeLabel(d.savedAt)} · {draftExpiresInLabel(d.savedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => {
                  onRestore(d.data);
                  toast({ title: "Formulário restaurado!", description: "Confira os dados antes de gerar." });
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Remover rascunho"
                onClick={() => setDrafts(removeFormDraft(docType, d.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-muted-foreground">
        Fotos e assinaturas não ficam salvas — reenvie apenas o arquivo.
      </p>
    </div>
  );
}
