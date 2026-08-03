/**
 * Estado global da tela de carregamento das gerações (preview e PDF final).
 * Evita que o usuário veja o documento sendo remontado (troca do QR Code).
 */
type Listener = (state: { active: boolean; label: string }) => void;

let pending = 0;
let label = "Gerando documento...";
const listeners = new Set<Listener>();

function emit() {
  const snapshot = { active: pending > 0, label };
  listeners.forEach((l) => l(snapshot));
}

export function subscribePdfLoading(listener: Listener): () => void {
  listeners.add(listener);
  listener({ active: pending > 0, label });
  return () => listeners.delete(listener);
}

export function beginPdfLoading(message?: string) {
  if (message) label = message;
  pending += 1;
  emit();
}

export function endPdfLoading() {
  pending = Math.max(0, pending - 1);
  emit();
}

export function getPdfLoading() {
  return { active: pending > 0, label };
}
