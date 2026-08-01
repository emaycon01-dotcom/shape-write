// Integração com o portal de validação — Atestado Unimed
// O site de validação (https://verificamemed.site) apenas LÊ os dados do nosso
// banco através da RPC pública `verify_atestado(_token)`.
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const VALIDACAO_BASE_URL = "https://verificamemed.site";

export const PDF_BUCKET = "documentos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: string): string {
  return s(v).replace(/\D/g, "");
}

function dateOnly(v: string): string {
  const m = s(v).match(/(\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : s(v).trim();
}

/** "05:53:23" -> "05:53" */
function toHm(v: string): string {
  const m = s(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** "2023-11-08" -> "08/11/2023" (mantém já formatado em BR) */
function toBrDate(v: string): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[0];
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : "";
}

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function randomToken(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

function randomCodigoAcesso(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/** ID local (fallback/log). */
export function buildDocumentoId(d: Record<string, string>): string {
  const key = onlyDigits(s(d.cpf)) || onlyDigits(s(d.cns)) || "00000000000";
  return `UNI-${key}`;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function splitMedico(nome: string): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dra\.?\s/i.test(raw) ? "DRA" : "DR";
  return { nome: raw.replace(/^dra?\.?\s+/i, "").trim(), genero };
}

function buildTextoAtestado(dias: number): string {
  if (dias <= 1) {
    return "atesto que o(a) paciente acima necessitou de repouso domiciliar por razões médicas no dia de hoje.";
  }
  return `atesto que o(a) paciente acima necessitou de afastamento de suas atividades por ${
    String(dias).padStart(2, "0")
  } dias por razões médicas.`;
}

export interface RegisterResult {
  documentoId: string;
  qrCodeUrl: string;
  token?: string;
  registered: boolean;
  error?: string;
}

const REQUIRED: Array<[string, string]> = [
  ["nome_paciente", "Nome do paciente"],
  ["cpf", "CPF"],
  ["data_nascimento", "Data de nascimento"],
  ["nome_medico", "Nome do profissional"],
  ["crm", "CRM"],
];

export async function registerValidationDocument(
  d: Record<string, string>,
): Promise<RegisterResult> {
  const documentoId = buildDocumentoId(d);

  const dias = Math.min(14, Math.max(1, Number(d.dias || "1") || 1));
  const medico = splitMedico(d.medico);

  const emissaoData = toBrDate(d.emitido_em) || toBrDate(d.data_emissao) ||
    toBrDate(d.data_atendimento);
  const emissaoHora = toHm(d.emitido_em) || toHm(d.hora_assinatura) ||
    toHm(d.hora_atendimento) || "00:00";

  const enderecoClinica = [
    s(d.unidade_curta || d.unidade).trim(),
    s(d.endereco).trim(),
    s(d.telefone).trim() ? `Telefone: ${s(d.telefone).trim()}` : "",
  ].filter(Boolean).join(" - ");

  const row = {
    token: randomToken(7),
    codigo_acesso: randomCodigoAcesso(),
    emissao_atestado: `${emissaoData} - ${emissaoHora}`.trim(),
    nome_paciente: s(d.paciente).trim(),
    cpf: s(d.cpf).trim(),
    data_nascimento: toBrDate(d.nascimento) || dateOnly(d.nascimento),
    endereco: s(d.endereco_paciente || "").trim() || null,
    nome_medico: medico.nome,
    genero_medico: medico.genero,
    crm: onlyDigits(d.crm_numero || d.crm),
    crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "RJ").toUpperCase(),
    endereco_clinica: enderecoClinica || null,
    texto_atestado: buildTextoAtestado(dias),
    quantidade: dias,
    pdf_url: null as string | null,
  };

  const faltando = REQUIRED
    .filter(([k]) => !s((row as Record<string, unknown>)[k]))
    .map(([, label]) => label);

  if (faltando.length) {
    return {
      documentoId,
      qrCodeUrl: "",
      registered: false,
      error: `Campos obrigatórios para validação: ${faltando.join(", ")}`,
    };
  }

  try {
    const supabase = serviceClient();
    const { error } = await supabase.from("atestados").insert(row);
    if (error) {
      console.error("Falha ao registrar atestado Unimed:", error.message);
      return { documentoId, qrCodeUrl: "", registered: false, error: error.message };
    }
    return {
      documentoId,
      qrCodeUrl: `${VALIDACAO_BASE_URL}/atestado?token=${row.token}`,
      token: row.token,
      registered: true,
    };
  } catch (err) {
    console.error("Erro de rede ao registrar atestado Unimed:", err);
    return { documentoId, qrCodeUrl: "", registered: false, error: String(err) };
  }
}

/** Sobe o PDF final no Storage e grava a URL assinada em `atestados.pdf_url`. */
export async function attachPdf(token: string, pdf: Uint8Array): Promise<string | null> {
  try {
    const supabase = serviceClient();
    const path = `atestados/${token}.pdf`;

    const { error: upErr } = await supabase.storage.from(PDF_BUCKET).upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("Falha ao subir PDF do atestado:", upErr.message);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      console.error("Falha ao assinar URL do PDF:", error?.message);
      return null;
    }

    await supabase.from("atestados").update({ pdf_url: data.signedUrl }).eq("token", token);
    return data.signedUrl;
  } catch (err) {
    console.error("Erro ao anexar PDF do atestado:", err);
    return null;
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

export { dateOnly };
