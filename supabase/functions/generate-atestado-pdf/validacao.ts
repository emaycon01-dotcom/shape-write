// Integração com o Site 2 (validação por QR Code) — Atestado Médico Digital
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

function dateOnly(v: string): string {
  const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : v.trim();
}

/** ID determinístico: reenviar o mesmo documento atualiza o registro (upsert). */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyDigits(s(d.cpf)) || onlyDigits(s(d.cns)) || "00000000000";
  return `ATM-${key}`;
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
  const fallbackUrl = `${VALIDACAO_BASE_URL}/validar-atestado?id=${encodeURIComponent(documentoId)}`;

  const payload: Record<string, string> = {
    tipo: "atestado-medico",
    documento_id: documentoId,
    nome: s(d.paciente).toUpperCase(),
    nome_completo: s(d.paciente).toUpperCase(),
    cpf: s(d.cpf),
    cns: s(d.cns),
    unidade: s(d.unidade),
    endereco: [s(d.endereco1), s(d.endereco2), s(d.endereco3)].filter(Boolean).join(" - "),
    data_atendimento: dateOnly(s(d.data_atendimento)),
    hora_atendimento: s(d.hora_atendimento),
    dias_repouso: s(d.dias),
    motivo: s(d.motivo),
    cid: s(d.cid),
    medico: s(d.medico),
    crm: s(d.crm),
    emitido_em: s(d.emitido_em),
    liberado_em: `${dateOnly(s(d.liberado_data))} ${s(d.liberado_hora)}`.trim(),
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
