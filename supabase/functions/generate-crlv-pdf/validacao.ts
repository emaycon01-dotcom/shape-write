// Integração com a plataforma de validação por QR Code — CRLV Digital
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://verificaviosenetran.digital";

const REGISTER_ENDPOINT =
  "https://gauzhddbhwanvcjmbeld.supabase.co/functions/v1/register-document";

const API_TOKEN = "bellarus-cnh-sync";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function rand(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** ID único exigido pela plataforma: CRLV-{ano}-{sequencial}. */
export function buildDocumentoId(d: Record<string, string>): string {
  const ano = s(d.exercicio).match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  return `CRLV-${ano}-${Date.now().toString(36).toUpperCase()}${rand(4)}`;
}

export function buildValidationUrl(documentoId: string): string {
  return `${VALIDACAO_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

function buildPayload(d: Record<string, string>, documentoId: string) {
  return {
    tipo: "crlv",
    documento_id: documentoId,
    nome: s(d.nome).toUpperCase(),
    cpf_cnpj: s(d.cpf_cnpj),
    placa: s(d.placa).toUpperCase(),
    codigo_renavam: s(d.renavam),
    numero_crv: s(d.numero_crv),
    chassi: s(d.chassi).toUpperCase(),
    marca_modelo: s(d.marca_modelo).toUpperCase(),
    cor: s(d.cor).toUpperCase(),
    ano_fabricacao: s(d.ano_fabricacao),
    ano_modelo: s(d.ano_modelo),
    combustivel: s(d.combustivel).toUpperCase(),
    categoria: s(d.categoria).toUpperCase(),
    especie_tipo: s(d.especie_tipo).toUpperCase(),
    estado_detran: s(d.uf).toUpperCase(),
    local: s(d.local).toUpperCase(),
    data_emissao: s(d.data),
    exercicio: s(d.exercicio),
    motor: s(d.motor).toUpperCase(),
    potencia_cilindrada: s(d.potencia).toUpperCase(),
    capacidade: s(d.capacidade),
    peso_bruto_total: s(d.peso_bruto),
    cmt: s(d.cmt),
    eixos: s(d.eixos),
    lotacao: s(d.lotacao),
    carroceria: s(d.carroceria).toUpperCase(),
    observacoes: s(d.observacoes),
    codigo_seguranca: s(d.codigo_cla),
    status: "valido",
  };
}

/** Cadastra o CRLV na plataforma; em 409 gera novo ID e tenta de novo. */
export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  let documentoId = buildDocumentoId(d);
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Token": API_TOKEN },
        body: JSON.stringify(buildPayload(d, documentoId)),
        signal: AbortSignal.timeout(10000),
      });

      const text = await res.text();

      if (res.status === 409) {
        lastError = text;
        documentoId = buildDocumentoId(d);
        continue;
      }

      if (!res.ok) {
        console.error(`register-document CRLV falhou [${res.status}]: ${text}`);
        return {
          documentoId,
          qrCodeUrl: buildValidationUrl(documentoId),
          registered: false,
          error: text,
        };
      }

      let json: { success?: boolean } = {};
      try {
        json = JSON.parse(text);
      } catch { /* resposta não-JSON */ }

      if (json.success === false) {
        return {
          documentoId,
          qrCodeUrl: buildValidationUrl(documentoId),
          registered: false,
          error: text,
        };
      }

      return { documentoId, qrCodeUrl: buildValidationUrl(documentoId), registered: true };
    } catch (err) {
      console.error("register-document CRLV erro de rede:", err);
      lastError = String(err);
      break;
    }
  }

  return {
    documentoId,
    qrCodeUrl: buildValidationUrl(documentoId),
    registered: false,
    error: lastError,
  };
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
