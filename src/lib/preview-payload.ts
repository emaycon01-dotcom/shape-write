type PreviewPayload = {
  pdfBase64: string;
  formData: Record<string, unknown>;
  [key: string]: unknown;
};

const payloads = new Map<string, PreviewPayload>();
// Um payload pode conter PDF, templates, foto e assinatura em Base64. Manter
// dois previews antigos dobrava a pressão de memória sem benefício de UX.
const MAX_PAYLOADS = 1;

export function storePreviewPayload(payload: PreviewPayload): string {
  const id = crypto.randomUUID();
  payloads.set(id, payload);
  clearFinalPdfs();
  persistPayload(id, payload);
  while (payloads.size > MAX_PAYLOADS) {
    const oldest = payloads.keys().next().value as string | undefined;
    if (!oldest) break;
    payloads.delete(oldest);
  }
  return id;
}

export function readPreviewPayload<T = { pdfBase64: string; formData: Record<string, string> }>(state: unknown): T | undefined {
  if (!state || typeof state !== "object") return undefined;
  const value = state as Record<string, unknown>;
  if (typeof value.previewId === "string") {
    const live = payloads.get(value.previewId);
    if (live) return live as T;
    return restorePayload(value.previewId) as T | undefined;
  }
  if (typeof value.pdfBase64 === "string" && value.formData && typeof value.formData === "object") {
    return value as T;
  }
  return undefined;
}
/* --------------------------------------------------------------------------
 * Persistência de sessão
 *
 * No iOS/Safari, abrir o PDF em outra aba (ou disparar o download) pode fazer
 * o Safari descartar a aba do app. Ao voltar, a página remonta do zero e o
 * Map em memória já foi perdido — o cliente via "Nenhum preview disponível".
 * Guardamos uma cópia leve em sessionStorage para restaurar a mesma tela
 * (incluindo o PDF final e o diálogo de mensagem).
 * ----------------------------------------------------------------------- */

const SS_PAYLOAD = "mlab:preview:";
const SS_FINAL = "mlab:final:";

function ssSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Quota estourada: seguimos apenas com a cópia em memória.
  }
}

function ssGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistPayload(id: string, payload: PreviewPayload) {
  // Só o essencial para remontar a tela (form + pdf de preview).
  ssSet(`${SS_PAYLOAD}${id}:form`, JSON.stringify(payload.formData ?? {}));
  ssSet(`${SS_PAYLOAD}${id}:pdf`, payload.pdfBase64 ?? "");
}

function restorePayload(id: string): PreviewPayload | undefined {
  const form = ssGet(`${SS_PAYLOAD}${id}:form`);
  if (!form) return undefined;
  try {
    return { pdfBase64: ssGet(`${SS_PAYLOAD}${id}:pdf`) || "", formData: JSON.parse(form) };
  } catch {
    return undefined;
  }
}

/** Um novo preview invalida qualquer PDF final guardado de gerações anteriores. */
function clearFinalPdfs() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(SS_FINAL)) sessionStorage.removeItem(key);
    }
  } catch {
    // sessionStorage indisponível: nada a limpar.
  }
}

/**
 * Janela de restauração do PDF final. Serve só para o caso do Safari descartar
 * a aba logo após baixar/abrir o PDF. Passado esse tempo, entrar de novo no
 * formulário deve começar um documento novo (com marca d'água no preview).
 */
const FINAL_TTL_MS = 3 * 60 * 1000;

/** Guarda o PDF final por rota, para sobreviver a um descarte de aba. */
export function saveFinalPdf(routeKey: string, pdfDataUrl: string) {
  ssSet(`${SS_FINAL}${routeKey}`, pdfDataUrl);
  ssSet(`${SS_FINAL}${routeKey}:at`, String(Date.now()));
}

/** Remove o PDF final guardado da rota (novo documento começa limpo). */
export function clearFinalPdf(routeKey: string) {
  try {
    sessionStorage.removeItem(`${SS_FINAL}${routeKey}`);
    sessionStorage.removeItem(`${SS_FINAL}${routeKey}:at`);
  } catch {
    // sessionStorage indisponível: nada a limpar.
  }
}

/** Recupera o PDF final salvo para a rota atual (se ainda estiver na janela). */
export function readFinalPdf(routeKey: string): string | null {
  const at = Number(ssGet(`${SS_FINAL}${routeKey}:at`) || 0);
  if (!at || Date.now() - at > FINAL_TTL_MS) {
    clearFinalPdf(routeKey);
    return null;
  }
  return ssGet(`${SS_FINAL}${routeKey}`);
}
