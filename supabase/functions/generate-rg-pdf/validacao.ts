// Integração com o Site 2 (validação por QR Code) — RG Digital / CIN
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://certificado-qrcode-vio.info";

const REGISTER_ENDPOINT =
  "https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document";

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

/** ID determinístico: reenviar o mesmo documento atualiza o registro (upsert). */
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
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar-rg?id=${encodeURIComponent(documentoId)}`;

  const nome = s(d.nome_completo).toUpperCase();
  const doador = s(d.doador).trim().toUpperCase();

  // A foto precisa chegar como URL https pública (o portal usa direto em <img src>)
  const fotoRaw = s(d.foto) || s(d.foto_base64);
  const fotoDataUrl = fotoRaw
    ? (fotoRaw.startsWith("data:") ? fotoRaw : `data:image/png;base64,${fotoRaw}`)
    : "";
  const fotoPura = fotoDataUrl.includes(",") ? fotoDataUrl.split(",")[1] : "";
  const fotoUrl = s(d.foto_public_url) || fotoDataUrl;


  const payload: Record<string, string> = {
    tipo: "rg-digital",
    documento_id: documentoId,
    nome,
    nome_completo: nome,
    cpf: s(d.cpf),
    rg: s(d.registro_geral).toUpperCase(),
    data_nascimento: dateOnly(s(d.data_nascimento)),
    naturalidade: s(d.naturalidade).toUpperCase(),
    sexo: sexo(s(d.sexo)),
    nacionalidade: s(d.nacionalidade).toUpperCase() || "BRASILEIRA",
    data_emissao: dateOnly(s(d.data_emissao)),
    data_validade: dateOnly(s(d.data_validade)),
    nome_pai: s(d.filiacao2).toUpperCase(),
    nome_mae: s(d.filiacao1).toUpperCase(),
    orgao_expedidor: s(d.orgao_expedidor).toUpperCase(),
    local_emissao: s(d.local_emissao).toUpperCase(),
    uf_orgao: s(d.uf_orgao).toUpperCase() || s(d.local_emissao).toUpperCase(),
    estado_civil: s(d.estado_civil).toUpperCase(),
    doador_orgaos: doador.startsWith("S") ? "SIM" : "NAO",
    codigo_seguranca: s(d.codigo_seguranca) || s(d.codigo_validacao),
    status: "valido",
    // enviado em vários formatos/chaves para cobrir o que o portal espera
    foto_base64: fotoDataUrl,
    foto: fotoDataUrl,
    foto_url: fotoDataUrl,
    foto_3x4: fotoDataUrl,
    foto_raw: fotoPura,
  };


  const token = Deno.env.get("VALIDACAO_API_TOKEN") || "site1-integracao";

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Token": token },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
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

    if (json.success === false) {
      return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
    }

    return {
      documentoId,
      // A API pode devolver um domínio placeholder — usamos sempre o oficial
      qrCodeUrl: fallbackUrl,
      registered: true,
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
