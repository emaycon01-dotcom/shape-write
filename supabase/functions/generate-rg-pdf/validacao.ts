// Integração com o Site 2 (validação por QR Code) — RG Digital / CIN
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL =
  "https://senetran-consultacarteira-digital-transito-vio.info";

const REGISTER_ENDPOINT =
  "https://nqjlmydtlckruwiqtlbe.supabase.co/functions/v1/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function sexo(genero: string): string {
  const t = genero.trim().toUpperCase();
  if (t.startsWith("F")) return "F";
  if (t.startsWith("M")) return "M";
  return "";
}

function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro. */
export function buildDocumentoId(d: Record<string, string>): string {
  const cpf = onlyDigits(s(d.cpf)) || "00000000000";
  return `RG-${cpf}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/**
 * Cadastra o RG no Site 2 e devolve a URL que vira QR Code.
 * Nunca lança: se a API falhar, cai no fallback determinístico.
 */
export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;

  const nome = s(d.nome_completo).toUpperCase();

  const payload: Record<string, string> = {
    documento_id: documentoId,
    tipo_documento: "RG",
    nome,
    nome_civil: nome,
    nome_social: s(d.nome_social).toUpperCase(),
    doc_identidade: s(d.registro_geral).toUpperCase(),
    cpf: s(d.cpf),
    data_nascimento: dateOnly(s(d.data_nascimento)),
    nacionalidade: s(d.nacionalidade).toUpperCase() || "BRA",
    naturalidade: s(d.naturalidade).toUpperCase(),
    sexo: sexo(s(d.sexo)),
    filiacao_pai: s(d.filiacao2).toUpperCase(),
    filiacao_mae: s(d.filiacao1).toUpperCase(),
    orgao_expedidor: s(d.orgao_expedidor).toUpperCase(),
    local: s(d.local_emissao).toUpperCase(),
    uf: s(d.local_emissao).toUpperCase(),
    validade: dateOnly(s(d.data_validade)),
    data_emissao: dateOnly(s(d.data_emissao)),
    titulo_eleitor: s(d.titulo_eleitor),
    tipo_sanguineo: s(d.tipo_sanguineo).toUpperCase(),
    estado_civil: s(d.estado_civil).toUpperCase(),
    doador: s(d.doador).toUpperCase(),
    certidao: s(d.certidao).toUpperCase(),
    cnh: s(d.cnh),
    cat_hab: s(d.categoria).toUpperCase(),
    pis_pasep: s(d.pis_pasep),
    nis: s(d.nis),
    nit: s(d.nit),
    ctps: s(d.ctps),
    dni: s(d.dni),
    cns: s(d.cns),
    observacoes: s(d.observacao_saude).toUpperCase(),
    status: "valido",
    foto: s(d.foto),
  };

  const token = Deno.env.get("VALIDACAO_API_TOKEN") || "";
  if (!token) {
    console.warn("VALIDACAO_API_TOKEN ausente — QR gerado sem cadastro remoto");
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: "missing_token" };
  }

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Token": token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`register-document falhou [${res.status}]: ${text}`);
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
    console.error("register-document erro de rede:", err);
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: String(err) };
  }
}

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 12; // 65x65 módulos
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
  const quiet = 0;
  const total = count + quiet * 2;
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
