import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

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

/** Código de validação determinístico (mesmo aluno + curso = mesmo código). */
export async function buildCodigoValidacao(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 4)}.${hex.slice(4, 7)}.${hex.slice(7, 19)}`;
}

/* ------------------------------------------------- portal de validação */

export const PORTAL_BASE_URL =
  Deno.env.get("PORTAL_VALIDACAO_BASE_URL") || "https://consultadiplomaestacio.digital";

const REGISTER_ENDPOINT = `${PORTAL_BASE_URL}/api/public/register-diploma`;

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function digits(v: string): string {
  return v.replace(/\D/g, "");
}

/** documento_id determinístico e estável: DIP-YYYYMMDD-NNNNNN */
export async function buildDocumentoId(seed: string, dataRef?: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const arr = new Uint8Array(buf);
  const num = ((arr[0] << 16) | (arr[1] << 8) | arr[2]) % 1000000;
  const d = toIsoDate(dataRef || "") || new Date().toISOString().slice(0, 10);
  return `DIP-${d.replace(/-/g, "")}-${String(num).padStart(6, "0")}`;
}

export function buildValidationUrl(documentoId: string): string {
  return `${PORTAL_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;
}

/** Converte dd/mm/aaaa (ou aaaa-mm-dd) para aaaa-mm-dd. */
export function toIsoDate(v: string): string {
  const t = s(v).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

/** CPF/RG mascarado conforme LGPD: ***.456.789-** */
export function maskCpf(v: string): string {
  const d = digits(v);
  if (d.length !== 11) return s(v);
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function maskCnpj(v: string): string {
  const d = digits(v);
  if (d.length !== 14) return s(v);
  return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
}

/** Flexiona o título conferido conforme o sexo. */
export function flexTitulo(titulo: string, sexo: string): string {
  const t = s(titulo).trim();
  if (!/^f/i.test(s(sexo))) return t;
  return t
    .replace(/Bacharel(?!a)/gi, "Bacharela")
    .replace(/Licenciado/gi, "Licenciada")
    .replace(/Tecnólogo/gi, "Tecnóloga");
}

export interface PortalResult {
  documentoId: string;
  validationUrl: string;
  registered: boolean;
  error?: string;
}

export async function registerDiplomaPortal(
  documentoId: string,
  payload: Record<string, unknown>,
): Promise<PortalResult> {
  const fallback = buildValidationUrl(documentoId);
  const apiKey = Deno.env.get("PORTAL_VALIDACAO_API_KEY");
  if (!apiKey) {
    return { documentoId, validationUrl: fallback, registered: false, error: "API key ausente" };
  }

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const text = await res.text();
    let json: { success?: boolean; validation_url?: string; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    if (!res.ok || json.success === false) {
      console.error(`register-diploma falhou [${res.status}] ${documentoId}: ${text.slice(0, 500)}`);
      return {
        documentoId,
        validationUrl: fallback,
        registered: false,
        error: json.error || `HTTP ${res.status}`,
      };
    }

    return { documentoId, validationUrl: json.validation_url || fallback, registered: true };
  } catch (err) {
    console.error("register-diploma erro de rede:", err);
    return { documentoId, validationUrl: fallback, registered: false, error: String(err) };
  }
}
