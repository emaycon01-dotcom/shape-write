// Verificação de atestado (Unimed) para o portal externo.
// Exige a chave de API no header `x-api-key` — não é mais público.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Max-Age": "86400",
};

const TOKEN_RE = /^[A-Za-z0-9-]{4,64}$/;

function maskCpf(cpf: string | null): string | null {
  if (!cpf) return null;
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  const expected = Deno.env.get("ATESTADO_VERIFY_API_KEY") ?? "";
  const provided = req.headers.get("x-api-key")
    ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const codigo = typeof body.codigo === "string" ? body.codigo.trim() : "";

  if (!TOKEN_RE.test(token)) {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row, error } = await supabase
    .from("atestados")
    .select(
      "token, codigo_acesso, emissao_atestado, nome_paciente, cpf, data_nascimento, nome_medico, crm, crm_uf, quantidade, texto_atestado, created_at",
    )
    .ilike("token", token)
    .maybeSingle();

  if (error) {
    console.error("lookup error", error.message);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers });
  }

  if (!row) {
    return new Response(JSON.stringify({ valid: false, error: "not_found" }), { status: 404, headers });
  }

  // Código de acesso é obrigatório quando o documento tem um
  if (row.codigo_acesso && row.codigo_acesso !== codigo) {
    return new Response(JSON.stringify({ valid: false, error: "codigo_invalido" }), { status: 403, headers });
  }

  return new Response(
    JSON.stringify({
      valid: true,
      atestado: {
        token: row.token,
        paciente: row.nome_paciente,
        cpf: maskCpf(row.cpf),
        data_nascimento: row.data_nascimento,
        profissional: row.nome_medico,
        crm: `${row.crm}/${row.crm_uf}`,
        emissao: row.emissao_atestado,
        dias_afastamento: row.quantidade,
        texto: row.texto_atestado,
        registrado_em: row.created_at,
      },
    }),
    { status: 200, headers },
  );
});
