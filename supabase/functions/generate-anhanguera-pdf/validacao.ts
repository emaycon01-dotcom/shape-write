import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** Portal oficial impresso no diploma Anhanguera. */
export const ANHANGUERA_VALIDACAO_URL = "https://diplomas.somosb4.com.br";

/**
 * Código de validação determinístico no padrão do documento:
 * 2773.671.xxxxxxxxxxxx (mesmos dados geram sempre o mesmo código).
 */
export async function buildCodigoValidacao(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `2773.671.${hex.slice(0, 12)}`;
}

/** URL final embutida no QR Code do verso. */
export function buildValidationUrl(codigo: string): string {
  return `${ANHANGUERA_VALIDACAO_URL}/validar?codigo=${encodeURIComponent(codigo)}`;
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 8;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/* --------------------------------------------- validador B4 (Site 2) */

export const B4_BASE_URL = "https://diplomassomosb4web.site";
const B4_REGISTER_ENDPOINT = `${B4_BASE_URL}/api/public/register-diploma-unopar`;

/** URL pública impressa no QR Code. */
export function buildB4ValidationUrl(documentoId: string): string {
  return `${B4_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;
}

export interface B4Result {
  registered: boolean;
  validationUrl: string;
  error?: string;
}

/** POST idempotente (upsert por documento_id) no validador B4. */
export async function registerDiplomaB4(
  documentoId: string,
  payload: Record<string, unknown>,
): Promise<B4Result> {
  const fallback = buildB4ValidationUrl(documentoId);
  const apiKey = Deno.env.get("DIPLOMA_UNOPAR_API_KEY") || "";
  if (!apiKey) {
    return { registered: false, validationUrl: fallback, error: "missing_api_key" };
  }

  try {
    const res = await fetch(B4_REGISTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...payload, documento_id: documentoId }),
      signal: AbortSignal.timeout(30000),
    });

    const text = await res.text();
    let json: { success?: boolean; validation_url?: string; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    if (!res.ok || json.success === false) {
      console.error(`register-diploma-unopar falhou [${res.status}] ${documentoId}: ${text.slice(0, 400)}`);
      return {
        registered: false,
        validationUrl: fallback,
        error: json.error || `HTTP ${res.status}`,
      };
    }

    return { registered: true, validationUrl: json.validation_url || fallback };
  } catch (err) {
    console.error("register-diploma-unopar erro de rede:", err);
    return { registered: false, validationUrl: fallback, error: String(err) };
  }
}
