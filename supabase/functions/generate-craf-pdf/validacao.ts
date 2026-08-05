// QR Code do CRAF (Certificado de Registro de Arma de Fogo).
//
// O portal de validação ainda será integrado: por enquanto o QR aponta para o
// domínio oficial de validação com um código de autenticidade determinístico
// (mesmo padrão "A Autenticidade no SisGCorp <hash>" do documento real).
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const CRAF_VALIDACAO_BASE_URL =
  Deno.env.get("CRAF_VALIDACAO_BASE_URL") || "https://verificamed.website";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

/** Hash de autenticidade (32 caracteres), estável para o mesmo documento. */
export async function buildAutenticidade(d: Record<string, string>): Promise<string> {
  const base = [
    onlyDigits(s(d.cpf)),
    s(d.nome).toUpperCase(),
    s(d.numero_serie).toUpperCase(),
    s(d.numero_sigma).toUpperCase(),
    s(d.data_expedicao),
  ].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** URL de validação — nunca usa domínio de desenvolvimento (lovable.app). */
export function buildValidacaoUrl(hash: string): string {
  const base = CRAF_VALIDACAO_BASE_URL.replace(/lovable\.app.*$/i, "").replace(/\/+$/, "") ||
    "https://verificamed.website";
  return `${base}/validar-craf?cod=${encodeURIComponent(hash)}`;
}

/* ------------------------------------------------ Validador Vio (externo) */

const CRAF_INGEST_URL = Deno.env.get("CRAF_INGEST_URL") ||
  "https://sbixggtneaplirjejejr.supabase.co/functions/v1/register-document";

/** UUID determinístico (v4-shaped) derivado dos dados — reenvio faz upsert. */
export async function buildDocumentoId(d: Record<string, string>): Promise<string> {
  const base = [
    onlyDigits(s(d.cpf)),
    s(d.numero_serie).toUpperCase(),
    s(d.numero_sigma).toUpperCase(),
  ].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  const b = Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-4${b.slice(13, 16)}-a${b.slice(17, 20)}-${b.slice(20, 32)}`;
}

export interface CrafRegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/** Cadastra o CRAF no validador e devolve a URL oficial do QR. */
export async function registerCrafDocument(
  d: Record<string, string>,
  fotoBase64: string,
): Promise<CrafRegisterResult> {
  const documentoId = await buildDocumentoId(d);
  const key = Deno.env.get("CRAF_INGEST_KEY") || "";

  if (!key) {
    return { documentoId, qrCodeUrl: "", registered: false, error: "CRAF_INGEST_KEY não configurada." };
  }
  if (!fotoBase64) {
    return { documentoId, qrCodeUrl: "", registered: false, error: "Foto 3x4 é obrigatória para a validação." };
  }

  const payload = {
    documento_id: documentoId,
    foto_base64: fotoBase64,
    nome: s(d.nome),
    cpf: s(d.cpf),
    rg: s(d.rg),
    sfpc: s(d.sfpc),
    amparo: s(d.amparo),
    validade: s(d.validade),
    registro: s(d.registro),
    tipo: s(d.tipo),
    marca: s(d.marca),
    calibre: s(d.calibre),
    serie: s(d.numero_serie),
    sigma: s(d.numero_sigma),
    data_expedicao: s(d.data_expedicao),
    assinado_por: s(d.assinante),
    cidade_uf: s(d.cidade),
    status: "valido",
  };

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(CRAF_INGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Token": key,
          "x-api-key": key,
          "apikey": key,
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      if (!res.ok) {
        lastError = `[${res.status}] ${text}`;
        console.error(`register-document (CRAF) falhou (tentativa ${attempt}): ${lastError}`);
        if (res.status === 400 || res.status === 401) break;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      const json = JSON.parse(text) as { success?: boolean; qr_code_url?: string; error?: string };
      if (!json.success || !json.qr_code_url) {
        lastError = json.error || text;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      return { documentoId, qrCodeUrl: json.qr_code_url, registered: true };
    } catch (err) {
      lastError = String(err);
      console.error("register-document (CRAF) erro de rede:", err);
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }

  return { documentoId, qrCodeUrl: "", registered: false, error: lastError };
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
      /* capacidade insuficiente — tenta a próxima versão */
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
