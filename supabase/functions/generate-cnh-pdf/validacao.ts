// Integração com o Site 2 (validação de CNH por QR Code)
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

function yesNo(v: string): "SIM" | "NAO" {
  const t = v.trim().toUpperCase();
  return t === "SIM" || t === "S" || t === "TRUE" ? "SIM" : "NAO";
}

function sexo(genero: string): string {
  const t = genero.trim().toUpperCase();
  if (t.startsWith("F")) return "F";
  if (t.startsWith("M")) return "M";
  return "";
}

/** Data estável no formato DD/MM/AAAA quando possível. */
function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro. */
export function buildDocumentoId(d: Record<string, string>): string {
  const cpf = onlyDigits(s(d.cpf)) || "00000000000";
  const reg = onlyDigits(s(d.registro)) || "0";
  return `CNH-${cpf}-${reg}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/**
 * Cadastra o documento no Site 2 e devolve a URL que deve virar QR Code.
 * Nunca lança: se a API falhar, cai no fallback determinístico da URL.
 */
export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar?id=${encodeURIComponent(documentoId)}`;

  const nome = s(d.nome_completo).toUpperCase();
  const uf = (s(d.cidade_estado).split(",").pop() || "").trim().toUpperCase();
  const local = s(d.cidade_estado).split(",")[0].trim().toUpperCase();

  const payload: Record<string, string> = {
    documento_id: documentoId,
    nome,
    nome_civil: nome,
    doc_identidade: s(d.rg).toUpperCase(),
    cpf: s(d.cpf),
    data_nascimento: dateOnly(s(d.data_nascimento)),
    nacionalidade: s(d.nacionalidade).toUpperCase() || "BRASILEIRA",
    sexo: sexo(s(d.genero)),
    filiacao_pai: s(d.nome_pai).toUpperCase(),
    filiacao_mae: s(d.nome_mae).toUpperCase(),
    permissao: yesNo(s(d.cnh_definitiva)) === "SIM" ? "NAO" : "SIM",
    acc: s(d.observacoes).toUpperCase().includes("ACC") ? "SIM" : "NAO",
    cat_hab: s(d.categoria).toUpperCase(),
    n_registro: s(d.registro),
    validade: dateOnly(s(d.data_validade)),
    primeira_habilitacao: dateOnly(s(d.data_primeira_habilitacao) || s(d.data_primeira_hab)),
    observacoes: s(d.observacoes).toUpperCase(),
    local,
    uf,
    data_emissao: dateOnly(s(d.data_emissao)),
    numero_validacao_cnh: s(d.numero_espelho),
    codigo_validacao: s(d.codigo_seguranca),
    numero_formulario_renach: s(d.renach),
    status: "valido",
    foto: s(d.foto_base64) || s(d.foto),
  };

  const token = Deno.env.get("VALIDACAO_API_TOKEN") || "";
  if (!token) {
    console.warn("VALIDACAO_API_TOKEN ausente — QR gerado sem cadastro remoto");
    return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: "missing_token" };
  }

  let lastError = "registration_failed";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Token": token },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const text = await res.text();
      if (res.ok) {
        let json: { qr_code_url?: string; success?: boolean } = {};
        try {
          json = JSON.parse(text);
        } catch { /* resposta não-JSON */ }

        if (json.success !== false) {
          return {
            documentoId,
            qrCodeUrl: json.qr_code_url || fallbackUrl,
            registered: true,
          };
        }
      }

      lastError = `HTTP ${res.status}: ${text.slice(0, 300)}`;
      console.error(`register-document tentativa ${attempt} falhou: ${lastError}`);
    } catch (err) {
      lastError = String(err);
      console.error(`register-document tentativa ${attempt} com erro de rede:`, err);
    }

    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
  }

  return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: lastError };
}

/** QR Code vetorial (SVG) — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  // Força uma versão alta (módulos menores/mais densos, como no documento oficial)
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
  const quiet = 0; // zona de silêncio (mesma moldura branca da referência)
  const total = count + quiet * 2;
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
