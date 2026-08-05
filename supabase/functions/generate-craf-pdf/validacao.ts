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
