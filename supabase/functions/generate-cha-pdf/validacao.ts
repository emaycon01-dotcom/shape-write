// Integração com o portal de validação — CNH Marítima (CHA - Carteira de
// Habilitação de Amador). O domínio/endpoint podem ser trocados por variável
// de ambiente sem precisar alterar o código.
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL =
  Deno.env.get("CHA_VALIDACAO_BASE_URL") ||
  "https://cidadaniagov-info.site/";

const REGISTER_ENDPOINT =
  Deno.env.get("CHA_REGISTER_ENDPOINT") ||
  "https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function dateOnly(v: string): string {
  const m = s(v).match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s(v).trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro. */
export function buildDocumentoId(d: Record<string, string>): string {
  const cpf = onlyDigits(s(d.cpf)) || "00000000000";
  return `CHA-${cpf}`;
}

async function buildHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar-cha?id=${encodeURIComponent(documentoId)}`;

  const categoria = [s(d.categoria), s(d.categoria_en)]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  const payload: Record<string, string> = {
    tipo: "cha",
    documento_id: documentoId,
    nome: s(d.nome).toUpperCase(),
    cpf: s(d.cpf),
    data_nascimento: dateOnly(d.nascimento),
    categoria,
    data_validade: dateOnly(d.validade),
    numero_inscricao: s(d.inscricao).toUpperCase(),
    limites_navegacao: s(d.limites).toUpperCase(),
    emissor: s(d.orgao).toUpperCase() || "MARINHA DO BRASIL",
    data_emissao: dateOnly(d.data_emissao),
    restricoes_fisicas: s(d.requisitos).toUpperCase(),
    status: "valido",
    hash: await buildHash(`${documentoId}|${s(d.nome)}|${s(d.inscricao)}`),
  };

  const foto = s(d.foto_base64) || s(d.foto);
  if (foto) payload.foto_base64 = foto;

  const token = Deno.env.get("VALIDACAO_API_TOKEN") || "site1";

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Token": token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`register-document (CHA) falhou [${res.status}]: ${text}`);
      return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
    }

    let json: { qr_code_url?: string; success?: boolean } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    return {
      documentoId,
      qrCodeUrl: json.qr_code_url || fallbackUrl,
      registered: json.success !== false,
    };
  } catch (err) {
    console.error("register-document (CHA) erro de rede:", err);
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: String(err) };
  }
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "H");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "H");
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
