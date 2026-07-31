// Integração com o Site 2 (validação por QR Code) — CRLV Digital
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://certificado-qrcode-vio.info";

const REGISTER_ENDPOINT =
  "https://nkkvpnnpplezwdxxgpyr.functions.supabase.co/register-document";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyAlnum(v: string): string {
  return v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro (upsert). */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyAlnum(s(d.renavam)) || onlyAlnum(s(d.placa)) || "00000000000";
  return `CRLV-${key}`;
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
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar-crlv?id=${encodeURIComponent(documentoId)}`;

  const payload: Record<string, string> = {
    tipo: "crlv-digital",
    documento_id: documentoId,
    nome: s(d.nome).toUpperCase(),
    nome_completo: s(d.nome).toUpperCase(),
    cpf: s(d.cpf_cnpj),
    cpf_cnpj: s(d.cpf_cnpj),
    uf: s(d.uf).toUpperCase(),
    renavam: s(d.renavam),
    placa: s(d.placa).toUpperCase(),
    exercicio: s(d.exercicio),
    ano_fabricacao: s(d.ano_fabricacao),
    ano_modelo: s(d.ano_modelo),
    numero_crv: s(d.numero_crv),
    codigo_cla: s(d.codigo_cla),
    cat: s(d.cat),
    marca_modelo: s(d.marca_modelo),
    especie_tipo: s(d.especie_tipo),
    placa_anterior: s(d.placa_anterior),
    chassi: s(d.chassi).toUpperCase(),
    cor: s(d.cor),
    combustivel: s(d.combustivel),
    categoria: s(d.categoria),
    capacidade: s(d.capacidade),
    potencia: s(d.potencia),
    peso_bruto: s(d.peso_bruto),
    motor: s(d.motor),
    cmt: s(d.cmt),
    eixos: s(d.eixos),
    lotacao: s(d.lotacao),
    carroceria: s(d.carroceria),
    local: s(d.local),
    data: s(d.data),
    observacoes: s(d.observacoes),
    status: "valido",
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

    let json: { success?: boolean } = {};
    try {
      json = JSON.parse(text);
    } catch { /* resposta não-JSON */ }

    if (json.success === false) {
      return { documentoId, qrCodeUrl: fallbackUrl, registered: false, error: text };
    }

    return { documentoId, qrCodeUrl: fallbackUrl, registered: true };
  } catch (err) {
    console.error("register-document erro de rede:", err);
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
