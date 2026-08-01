// Verificação de atestado (Unimed) para o portal externo.
// Aceita:
//   - x-api-key      : chave secreta (backend-a-backend)
//   - x-public-token : token público de leitura (pode ficar no frontend do validador)
// Não é mais uma RPC pública aberta.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key, x-public-token",
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

  const apiKey = req.headers.get("x-api-key")
    ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const publicToken = req.headers.get("x-public-token") ?? "";

  const expectedApiKey = Deno.env.get("ATESTADO_VERIFY_API_KEY") ?? "";
  const expectedPublicToken = Deno.env.get("ATESTADO_PUBLIC_TOKEN") ?? "";

  const isApiKeyValid = expectedApiKey && apiKey && timingSafeEqual(apiKey, expectedApiKey);
  const isPublicTokenValid = expectedPublicToken && publicToken && timingSafeEqual(publicToken, expectedPublicToken);

  if (!isApiKeyValid && !isPublicTokenValid) {
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
      "token, codigo_acesso, emissao_atestado, nome_paciente, cpf, data_nascimento, endereco, nome_medico, genero_medico, crm, crm_uf, endereco_clinica, texto_atestado, quantidade, pdf_url, created_at",
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
        codigo_acesso: row.codigo_acesso,
        paciente: row.nome_paciente,
        cpf: maskCpf(row.cpf),
        data_nascimento: row.data_nascimento,
        endereco: row.endereco,
        profissional: row.nome_medico,
        genero_profissional: row.genero_medico,
        crm: `${row.crm}/${row.crm_uf}`,
        endereco_clinica: row.endereco_clinica,
        emissao: row.emissao_atestado,
        dias_afastamento: row.quantidade,
        texto: row.texto_atestado,
        pdf_url: row.pdf_url,
        registrado_em: row.created_at,
      },
    }),
    { status: 200, headers },
  );
});
