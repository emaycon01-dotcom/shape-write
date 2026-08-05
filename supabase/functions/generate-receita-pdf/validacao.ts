// Integração com o portal de validação — Receita Médica (Unimed)
// O validador (https://verificamemed.site) lê os dados pela RPC pública
// `verify_receita(_token)`. A rota da receita é /validar?token=...
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const VALIDACAO_BASE_URL = "https://verificamemed.site";
export const PDF_BUCKET = "documentos";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 ano

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: unknown): string {
  return s(v).replace(/\D/g, "");
}

/** Token de 7 caracteres, mesmo padrão dos demais módulos Unimed. */
export function gerarToken(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

/** Código de acesso numérico de 4 dígitos. */
export function gerarCodigoAcesso(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

/** URL exigida pelo validador: /validar?token=XXXXXXX[&codigo=1234] */
export function linkValidacao(token: string, codigo?: string): string {
  const base = `${VALIDACAO_BASE_URL}/validar?token=${encodeURIComponent(token)}`;
  return codigo ? `${base}&codigo=${encodeURIComponent(codigo)}` : base;
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** "Dr(a). Ana Flavia" -> { nome: "Ana Flavia", genero: "DRA" } */
function splitMedico(nome: string): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dr\s*\(?\s*a\s*\)?\.?\s/i.test(raw) || /^dra\.?\s/i.test(raw)
    ? "DRA"
    : "DR";
  return { nome: raw.replace(/^dr\s*\(?\s*a?\s*\)?\.?\s+/i, "").trim(), genero };
}

/** "CRM 31186 GO" -> { numero: "31186", uf: "GO" } */
function splitCrm(raw: string): { numero: string; uf: string } {
  const txt = s(raw).toUpperCase();
  const uf = txt.match(/\b(A[CLPM]|BA|CE|DF|ES|GO|MA|M[GST]|P[ABEIR]|R[JNOSR]|S[CEP]|TO)\b/);
  return { numero: onlyDigits(txt), uf: uf ? uf[1] : "" };
}

const TIPOS = ["comum", "generico", "controlado", "tarja_vermelha", "tarja_preta"];

export interface MedicamentoIn {
  nome?: string;
  substancia?: string;
  posologia?: string;
  prescricao?: string;
  quantidade?: string;
  tipo?: string;
  farmaciaPopular?: boolean;
}

/** Converte os medicamentos do formulário para o formato do validador. */
export function medicamentosValidacao(meds: MedicamentoIn[]) {
  return (meds || []).map((m) => ({
    nome: s(m.nome),
    substancia: s(m.substancia) || s(m.nome).replace(/\s*\(.*?\)\s*/g, " ").trim(),
    prescricao: s(m.prescricao || m.posologia),
    quantidade: s(m.quantidade),
    tipo: TIPOS.includes(s(m.tipo)) ? s(m.tipo) : "comum",
    imagem: "",
    farmaciaPopular: Boolean(m.farmaciaPopular),
  }));
}

export interface RegisterResult {
  token: string;
  codigo_acesso: string;
  qrCodeUrl: string;
  registered: boolean;
  error?: string;
}

/** Grava a receita para o validador e devolve o link do QR Code. */
export async function registerReceita(
  d: Record<string, string>,
  medicamentos: MedicamentoIn[],
  opts: { token?: string; codigo_acesso?: string } = {},
): Promise<RegisterResult> {
  const token = (opts.token || gerarToken()).toUpperCase();
  const codigo = opts.codigo_acesso || gerarCodigoAcesso();
  const qrCodeUrl = linkValidacao(token, codigo);

  const medico = splitMedico(d.medico || "");
  const crm = splitCrm(d.crm || "");
  const enderecoClinica = [
    s(d.endereco_clinica).trim(),
    s(d.telefone).trim() ? `Telefone: ${s(d.telefone).trim()}` : "",
  ].filter(Boolean).join(" - ");

  const row = {
    token,
    codigo_acesso: codigo,
    emissao_receita: s(d.emissao).trim(),
    nome_paciente: s(d.paciente).trim(),
    cpf: s(d.cpf).trim(),
    data_nascimento: s(d.nascimento).trim(),
    endereco: s(d.endereco).trim() || null,
    nome_medico: medico.nome,
    genero_medico: medico.genero,
    crm: crm.numero,
    crm_uf: crm.uf,
    endereco_clinica: enderecoClinica || null,
    medicamentos: medicamentosValidacao(medicamentos),
    pdf_url: null as string | null,
  };

  if (!row.nome_paciente || !row.nome_medico) {
    return {
      token,
      codigo_acesso: codigo,
      qrCodeUrl,
      registered: false,
      error: "Campos obrigatórios para validação: paciente e médico.",
    };
  }

  try {
    const supabase = serviceClient();
    const { error } = await supabase.from("receitas").insert(row);
    if (error) {
      console.error("Falha ao registrar receita:", error.message);
      return { token, codigo_acesso: codigo, qrCodeUrl, registered: false, error: error.message };
    }
    return { token, codigo_acesso: codigo, qrCodeUrl, registered: true };
  } catch (err) {
    console.error("Erro de rede ao registrar receita:", err);
    return { token, codigo_acesso: codigo, qrCodeUrl, registered: false, error: String(err) };
  }
}

/** Sobe o PDF final no Storage e grava a URL assinada em `receitas.pdf_url`. */
export async function attachPdf(token: string, pdf: Uint8Array): Promise<string | null> {
  try {
    const supabase = serviceClient();
    const path = `receitas/${token}.pdf`;

    const { error: upErr } = await supabase.storage.from(PDF_BUCKET).upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("Falha ao subir PDF da receita:", upErr.message);
      return null;
    }

    const { data, error } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data?.signedUrl) {
      console.error("Falha ao assinar URL do PDF:", error?.message);
      return null;
    }

    await supabase.from("receitas").update({ pdf_url: data.signedUrl })
      .eq("token", token.toUpperCase());
    return data.signedUrl;
  } catch (err) {
    console.error("Erro ao anexar PDF da receita:", err);
    return null;
  }
}

/** QR Code SVG de alta densidade (versão mínima 12), igual aos outros módulos. */
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
