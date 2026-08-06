// Endpoint público de registro para sites parceiros.
// Permite que um app hospedado em OUTRO projeto grave atestados/receitas Unimed
// no banco lido pelo validador https://verificamemed.site.
//
// Segurança: exige o header `x-partner-token` (secret PARTNER_INGEST_TOKEN).
// O parceiro só consegue INSERIR documentos — nunca ler ou apagar dados.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VALIDACAO_BASE_URL = "https://verificamemed.site";
const TOKEN_ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function s(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function onlyDigits(v: unknown): string {
  return s(v).replace(/\D/g, "");
}

function toBrDate(v: unknown): string {
  const raw = s(v).trim();
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[0];
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : raw;
}

function gerarToken(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

function gerarCodigo(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}

function splitMedico(nome: unknown): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dra\.?\s/i.test(raw) || /^dr\s*\(?\s*a\s*\)?\.?\s/i.test(raw)
    ? "DRA"
    : "DR";
  return { nome: raw.replace(/^dr\s*\(?\s*a?\s*\)?\.?\s+/i, "").trim(), genero };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

const TIPOS = ["comum", "generico", "controlado", "tarja_vermelha", "tarja_preta"];

interface MedIn {
  nome?: string;
  substancia?: string;
  prescricao?: string;
  posologia?: string;
  quantidade?: string;
  tipo?: string;
  farmaciaPopular?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Headers": "content-type, x-partner-token" },
    });
  }
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const expected = Deno.env.get("PARTNER_INGEST_TOKEN") ?? "";
  const provided = req.headers.get("x-partner-token") ?? "";
  if (!expected || provided !== expected) {
    return json({ success: false, error: "Token de integração inválido." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "JSON inválido." }, 400);
  }

  const tipo = s(body.tipo).toLowerCase();
  const d = (body.dados ?? {}) as Record<string, unknown>;
  const supabase = serviceClient();

  const token = gerarToken(7);
  const codigo = gerarCodigo();

  try {
    if (tipo === "atestado") {
      const medico = splitMedico(d.medico ?? d.nome_medico);
      const dias = Math.min(14, Math.max(1, Number(d.dias ?? 1) || 1));
      const row = {
        token,
        codigo_acesso: codigo,
        emissao_atestado: s(d.emissao).trim() || toBrDate(d.data_emissao),
        nome_paciente: s(d.paciente ?? d.nome_paciente).trim(),
        cpf: s(d.cpf).trim(),
        data_nascimento: toBrDate(d.nascimento ?? d.data_nascimento),
        endereco: s(d.endereco).trim() || null,
        nome_medico: medico.nome,
        genero_medico: medico.genero,
        crm: onlyDigits(d.crm),
        crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "RJ").toUpperCase(),
        endereco_clinica: s(d.endereco_clinica).trim() || null,
        texto_atestado: s(d.texto_atestado).trim() ||
          (dias <= 1
            ? "atesto que o(a) paciente acima necessitou de repouso domiciliar por razões médicas no dia de hoje."
            : `atesto que o(a) paciente acima necessitou de afastamento de suas atividades por ${
              String(dias).padStart(2, "0")
            } dias por razões médicas.`),
        quantidade: dias,
        pdf_url: s(d.pdf_url).trim() || null,
      };

      const faltando: string[] = [];
      if (!row.nome_paciente) faltando.push("paciente");
      if (!row.cpf) faltando.push("cpf");
      if (!row.data_nascimento) faltando.push("nascimento");
      if (!row.nome_medico) faltando.push("medico");
      if (!row.crm) faltando.push("crm");
      if (faltando.length) {
        return json({ success: false, error: `Campos obrigatórios: ${faltando.join(", ")}` }, 400);
      }

      const { error } = await supabase.from("atestados").insert(row);
      if (error) return json({ success: false, error: error.message }, 500);

      return json({
        success: true,
        tipo: "atestado",
        token,
        codigo_acesso: codigo,
        validation_url: `${VALIDACAO_BASE_URL}/atestado?token=${token}&codigo=${codigo}`,
      });
    }

    if (tipo === "receita") {
      const medico = splitMedico(d.medico ?? d.nome_medico);
      const meds = Array.isArray(body.medicamentos) ? (body.medicamentos as MedIn[]) : [];
      const row = {
        token,
        codigo_acesso: codigo,
        emissao_receita: s(d.emissao).trim() || toBrDate(d.data_emissao),
        nome_paciente: s(d.paciente ?? d.nome_paciente).trim(),
        cpf: s(d.cpf).trim(),
        data_nascimento: toBrDate(d.nascimento ?? d.data_nascimento),
        endereco: s(d.endereco).trim() || null,
        nome_medico: medico.nome,
        genero_medico: medico.genero,
        crm: onlyDigits(d.crm),
        crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "").toUpperCase(),
        endereco_clinica: s(d.endereco_clinica).trim() || null,
        medicamentos: meds.map((m) => ({
          nome: s(m.nome),
          substancia: s(m.substancia) || s(m.nome).replace(/\s*\(.*?\)\s*/g, " ").trim(),
          prescricao: s(m.prescricao ?? m.posologia),
          quantidade: s(m.quantidade),
          tipo: TIPOS.includes(s(m.tipo)) ? s(m.tipo) : "comum",
          imagem: "",
          farmaciaPopular: Boolean(m.farmaciaPopular),
        })),
        pdf_url: s(d.pdf_url).trim() || null,
      };

      if (!row.nome_paciente || !row.nome_medico) {
        return json({ success: false, error: "Campos obrigatórios: paciente e medico." }, 400);
      }
      if (!row.medicamentos.length) {
        return json({ success: false, error: "Envie ao menos um medicamento." }, 400);
      }

      const { error } = await supabase.from("receitas").insert(row);
      if (error) return json({ success: false, error: error.message }, 500);

      return json({
        success: true,
        tipo: "receita",
        token,
        codigo_acesso: codigo,
        validation_url: `${VALIDACAO_BASE_URL}/validar?token=${token}&codigo=${codigo}`,
      });
    }

    return json({ success: false, error: 'Campo "tipo" deve ser "atestado" ou "receita".' }, 400);
  } catch (err) {
    console.error("register-partner-document:", err);
    return json({ success: false, error: "Erro interno ao registrar documento." }, 500);
  }
});
