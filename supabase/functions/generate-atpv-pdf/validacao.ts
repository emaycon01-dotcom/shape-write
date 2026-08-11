// Integração com a plataforma de validação por QR Code — ATPV-e
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

/** ID único exigido pela plataforma: ATPVE-{ano}-{sequencial}. */
export function buildDocumentoId(d: Record<string, string>): string {
  const ano = s(d.data_venda).match(/(\d{4})/)?.[1] || String(new Date().getFullYear());
  return `ATPVE-${ano}-${Date.now().toString(36).toUpperCase()}${rand(4)}`;
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
    tipo: "atpv",
    documento_id: documentoId,
    // Veículo
    placa: s(d.placa).toUpperCase(),
    codigo_renavam: s(d.renavam),
    chassi: s(d.chassi).toUpperCase(),
    marca_modelo: s(d.marca_modelo).toUpperCase(),
    cor: s(d.cor).toUpperCase(),
    ano_fabricacao: s(d.ano_fabricacao),
    ano_modelo: s(d.ano_modelo),
    cat: s(d.cat),
    hodometro: s(d.hodometro),
    numero_crv: s(d.numero_crv),
    codigo_seguranca: s(d.codigo_seguranca_crv),
    numero_atpve: s(d.numero_atpve),
    data_emissao_crv: s(d.data_emissao_crv),
    estado_detran: s(d.uf).toUpperCase(),
    // Vendedor
    nome: s(d.vend_nome).toUpperCase(),
    cpf_cnpj: s(d.vend_cpf),
    vendedor_nome: s(d.vend_nome).toUpperCase(),
    vendedor_cpf_cnpj: s(d.vend_cpf),
    vendedor_email: s(d.vend_email),
    vendedor_municipio: s(d.vend_municipio).toUpperCase(),
    vendedor_uf: s(d.vend_uf).toUpperCase(),
    // Comprador
    comprador_nome: s(d.comp_nome).toUpperCase(),
    comprador_cpf_cnpj: s(d.comp_cpf),
    comprador_email: s(d.comp_email),
    comprador_municipio: s(d.comp_municipio).toUpperCase(),
    comprador_uf: s(d.comp_uf).toUpperCase(),
    comprador_endereco: s(d.comp_endereco).toUpperCase(),
    // Venda
    valor_venda: s(d.valor_venda),
    local: s(d.local).toUpperCase(),
    data_emissao: s(d.data_venda),
    data_venda: s(d.data_venda),
    status: "valido",
  };
}

/** Cadastra o ATPV-e na plataforma; em 409 gera novo ID e tenta de novo. */
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
        console.error(`register-document ATPV falhou [${res.status}]: ${text}`);
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
      console.error("register-document ATPV erro de rede:", err);
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
