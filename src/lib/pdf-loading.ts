/**
 * Estado global da tela de carregamento das gerações (preview e PDF final).
 * Evita que o usuário veja o documento sendo remontado (troca do QR Code).
 */
type PdfLoadingState = { active: boolean; generating: boolean; label: string };
type Listener = (state: PdfLoadingState) => void;

let pendingGeneration = 0;
let pendingPresentation = 0;
let label = "Gerando documento...";
const listeners = new Set<Listener>();
let presentationTimer: number | undefined;

function emit() {
  const snapshot = {
    active: pendingGeneration > 0 || pendingPresentation > 0,
    generating: pendingGeneration > 0,
    label,
  };
  listeners.forEach((l) => l(snapshot));
}

export function subscribePdfLoading(listener: Listener): () => void {
  listeners.add(listener);
  listener({
    active: pendingGeneration > 0 || pendingPresentation > 0,
    generating: pendingGeneration > 0,
    label,
  });
  return () => listeners.delete(listener);
}

export function beginPdfLoading(message?: string) {
  if (message) label = message;
  pendingGeneration += 1;
  emit();
}

export function endPdfLoading() {
  pendingGeneration = Math.max(0, pendingGeneration - 1);
  emit();
}

/**
 * Mantém a tela global até o visualizador terminar a PRIMEIRA pintura do PDF.
 * Sem isso a geração acabava corretamente, mas o usuário ainda via por alguns
 * segundos o canvas vazio enquanto o PDF.js decodificava o arquivo.
 */
export function awaitPdfPresentation() {
  pendingPresentation = 1;
  if (presentationTimer) window.clearTimeout(presentationTimer);
  // Failsafe: um erro no visualizador nunca pode prender a interface.
  presentationTimer = window.setTimeout(() => completePdfPresentation(), 15_000);
  emit();
}

export function completePdfPresentation() {
  pendingPresentation = 0;
  if (presentationTimer) {
    window.clearTimeout(presentationTimer);
    presentationTimer = undefined;
  }
  emit();
}

export function getPdfLoading() {
  return {
    active: pendingGeneration > 0 || pendingPresentation > 0,
    generating: pendingGeneration > 0,
    label,
  };
}
