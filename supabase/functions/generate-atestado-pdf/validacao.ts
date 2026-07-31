// Integração com o portal de validação (AtestaFácil) — Atestado Médico Digital
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

export const VALIDACAO_BASE_URL = "https://atestafacil.lovable.app";

const REGISTER_ENDPOINT =
  "https://xrfbhiihyvqoajjcdcky.supabase.co/functions/v1/register-document";

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

/** "08/11/2023" | "2023-11-08" -> "2023-11-08" */
function toIsoDate(v: string): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

/** "05:53:23" -> "05:53" */
function toHm(v: string): string {
  const m = s(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function addDays(isoDate: string, days: number): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ID local (fallback/log) — o token oficial vem sempre da API. */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyDigits(s(d.cpf)) || onlyDigits(s(d.cns)) || "00000000000";
  return `ATM-${key}`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  token?: string;
  registered: boolean;
  error?: string;
}

function buildPayload(d: Record<string, string>) {
  const start = toIsoDate(d.data_atendimento);
  const dias = Math.max(1, Number(d.dias || "1") || 1);
  const endereco = [s(d.endereco1), s(d.endereco2), s(d.endereco3)]
    .filter(Boolean)
    .join(" - ");

  const emitido = s(d.emitido_em);
  const issueDate = toIsoDate(emitido) || toIsoDate(d.data_emissao) || start;
  const issueTime = toHm(emitido) || toHm(d.liberado_hora) || toHm(d.hora_atendimento);

  return {
    patient_name: s(d.paciente).trim(),
    patient_cpf: s(d.cpf).trim(),
    patient_birth_date: toIsoDate(d.nascimento),
    patient_state: s(d.uf).trim().toUpperCase(),
    patient_cns: onlyDigits(s(d.cns)),
    professional_name: s(d.medico).trim(),
    professional_crm: s(d.crm).trim(),
    professional_specialty: s(d.especialidade).trim(),
    unit_name: s(d.unidade_curta || d.unidade).trim(),
    unit_address: endereco,
    start_date: start,
    end_date: addDays(start, dias - 1),
    cid: s(d.cid).trim(),
    days_off: dias,
    issue_date: issueDate,
    issue_time: issueTime,
    consultation_date: start,
    consultation_time: toHm(d.hora_atendimento),
  };
}

const REQUIRED: Array<[string, string]> = [
  ["patient_name", "Nome do paciente"],
  ["patient_cpf", "CPF"],
  ["patient_birth_date", "Data de nascimento"],
  ["professional_name", "Nome do profissional"],
  ["professional_crm", "CRM"],
  ["unit_name", "Unidade"],
  ["unit_address", "Endereço da unidade"],
  ["start_date", "Data do atendimento"],
  ["end_date", "Data final do afastamento"],
  ["cid", "CID"],
];

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);
  const payload = buildPayload(d) as Record<string, unknown>;

  const faltando = REQUIRED
    .filter(([k]) => !s(payload[k]))
    .map(([, label]) => label);

  if (faltando.length) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: `Campos obrigatórios para validação: ${faltando.join(", ")}`,
    };
  }

  const apiKey = Deno.env.get("BELLARUS_API_KEY") || "";
  if (!apiKey) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: "BELLARUS_API_KEY não configurada.",
    };
  }

  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const text = await res.text();

      if (!res.ok) {
        lastError = `[${res.status}] ${text}`;
        console.error(`register-document falhou (tentativa ${attempt}): ${lastError}`);
        if (res.status === 400 || res.status === 401) break; // não adianta repetir
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const json = JSON.parse(text) as {
        success?: boolean;
        token?: string;
        verify_url?: string;
        document_id?: string;
      };

      if (json.success === false || !json.token) {
        lastError = text;
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }

      const verifyUrl = json.verify_url ||
        `${VALIDACAO_BASE_URL}/verificar?id=${encodeURIComponent(json.token)}`;

      return {
        documentoId: json.document_id || documentoId,
        qrCodeUrl: verifyUrl,
        token: json.token,
        registered: true,
      };
    } catch (err) {
      lastError = String(err);
      console.error(`register-document erro de rede (tentativa ${attempt}):`, err);
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

export { dateOnly };
