// Espelha receitas/atestados emitidos no backend principal para o banco lido
// pelo validador (https://verificamemed.site).
//
// Depois da migração do backend, os documentos passaram a ser gravados apenas
// no projeto principal — e o validador, que lê deste projeto, não encontrava
// mais nada ("Receita não encontrada"). Esta função recebe o MESMO token/código
// gerado na emissão e replica o registro aqui, de forma idempotente.
//
// Exige sessão válida do usuário; a chave de serviço nunca sai do servidor.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authenticateRequest } from "../_shared/auth.ts";

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

function toHm(v: unknown): string {
  const m = s(v).match(/(\d{2}):(\d{2})/);
  return m ? m[0] : "";
}

function splitMedico(nome: unknown): { nome: string; genero: "DR" | "DRA" } {
  const raw = s(nome).trim();
  const genero: "DR" | "DRA" = /^dra\.?\s/i.test(raw) || /^dr\s*\(?\s*a\s*\)?\.?\s/i.test(raw)
    ? "DRA"
    : "DR";
  return { nome: raw.replace(/^dr\s*\(?\s*a?\s*\)?\.?\s+/i, "").trim(), genero };
}

function splitCrm(raw: unknown): { numero: string; uf: string } {
  const txt = s(raw).toUpperCase();
  const uf = txt.match(/\b(A[CLPM]|BA|CE|DF|ES|GO|MA|M[GST]|P[ABEIR]|R[JNOSR]|S[CEP]|TO)\b/);
  return { numero: onlyDigits(txt), uf: uf ? uf[1] : "" };
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

function parseMeds(raw: unknown): MedIn[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  return Array.isArray(value) ? (value as MedIn[]) : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const auth = await authenticateRequest(req, corsHeaders);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  const tipo = s(body.tipo).toLowerCase();
  const token = s(body.token).trim();
  const codigo = s(body.codigo_acesso).trim() || onlyDigits(body.codigo_acesso).slice(0, 4);
  const d = (body.dados ?? {}) as Record<string, unknown>;

  if (!token) return json({ success: false, error: "missing_token" }, 400);
  if (tipo !== "receita" && tipo !== "atestado") {
    return json({ success: false, error: "invalid_tipo" }, 400);
  }

  const supabase = serviceClient();
  const medico = splitMedico(d.medico ?? d.nome_medico);

  try {
    if (tipo === "receita") {
      const crm = splitCrm(d.crm);
      const enderecoClinica = [
        s(d.endereco_clinica).trim(),
        s(d.telefone).trim() ? `Telefone: ${s(d.telefone).trim()}` : "",
      ].filter(Boolean).join(" - ");

      const row = {
        token: token.toUpperCase(),
        codigo_acesso: codigo,
        emissao_receita: s(d.emissao).trim() || toBrDate(d.data_emissao),
        nome_paciente: s(d.paciente ?? d.nome_paciente).trim(),
        cpf: s(d.cpf).trim(),
        data_nascimento: s(d.nascimento).trim() || toBrDate(d.data_nascimento),
        endereco: s(d.endereco).trim() || null,
        nome_medico: medico.nome,
        genero_medico: medico.genero,
        crm: crm.numero,
        crm_uf: crm.uf,
        endereco_clinica: enderecoClinica || null,
        medicamentos: parseMeds(body.medicamentos ?? d.medicamentos).map((m) => ({
          nome: s(m.nome),
          substancia: s(m.substancia) || s(m.nome).replace(/\s*\(.*?\)\s*/g, " ").trim(),
          prescricao: s(m.prescricao ?? m.posologia),
          quantidade: s(m.quantidade),
          tipo: TIPOS.includes(s(m.tipo)) ? s(m.tipo) : "comum",
          imagem: "",
          farmaciaPopular: Boolean(m.farmaciaPopular),
        })),
      };

      if (!row.nome_paciente || !row.nome_medico) {
        return json({ success: false, error: "campos_obrigatorios" }, 400);
      }

      const { error } = await supabase.from("receitas").upsert(row, { onConflict: "token" });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, tipo, token: row.token });
    }

    // Atestado (Unimed e similares)
    const dias = Math.min(14, Math.max(1, Number(d.dias ?? 1) || 1));
    const emissaoData = toBrDate(d.emitido_em) || toBrDate(d.data_emissao) ||
      toBrDate(d.data_atendimento) || toBrDate(d.emissao);
    const emissaoHora = toHm(d.emitido_em) || toHm(d.hora_assinatura) ||
      toHm(d.hora_atendimento) || "00:00";
    const enderecoClinica = [
      s(d.unidade_curta ?? d.unidade).trim(),
      s(d.endereco).trim(),
      s(d.telefone).trim() ? `Telefone: ${s(d.telefone).trim()}` : "",
    ].filter(Boolean).join(" - ");

    const row = {
      token: token.toUpperCase(),
      codigo_acesso: codigo,
      emissao_atestado: `${emissaoData} - ${emissaoHora}`.trim(),
      nome_paciente: s(d.paciente ?? d.nome_paciente).trim(),
      cpf: s(d.cpf).trim(),
      data_nascimento: toBrDate(d.nascimento ?? d.data_nascimento),
      endereco: s(d.endereco_paciente).trim() || null,
      nome_medico: medico.nome,
      genero_medico: medico.genero,
      crm: onlyDigits(d.crm_numero ?? d.crm),
      crm_uf: (s(d.crm_uf).replace(/^CRM[-\s]?/i, "").trim() || "RJ").toUpperCase(),
      endereco_clinica: enderecoClinica || null,
      texto_atestado: s(d.texto_atestado).trim() ||
        (dias <= 1
          ? "atesto que o(a) paciente acima necessitou de repouso domiciliar por razões médicas no dia de hoje."
          : `atesto que o(a) paciente acima necessitou de afastamento de suas atividades por ${
            String(dias).padStart(2, "0")
          } dias por razões médicas.`),
      quantidade: dias,
    };

    if (!row.nome_paciente || !row.nome_medico) {
      return json({ success: false, error: "campos_obrigatorios" }, 400);
    }

    const { error } = await supabase.from("atestados").upsert(row, { onConflict: "token" });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, tipo, token: row.token });
  } catch (err) {
    console.error("mirror-validation-doc:", err);
    return json({ success: false, error: "internal_error" }, 500);
  }
});
