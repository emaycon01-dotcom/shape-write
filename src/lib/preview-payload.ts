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
  if (typeof value.previewId === "string") return payloads.get(value.previewId) as T | undefined;
  if (typeof value.pdfBase64 === "string" && value.formData && typeof value.formData === "object") {
    return value as T;
  }
  return undefined;
}