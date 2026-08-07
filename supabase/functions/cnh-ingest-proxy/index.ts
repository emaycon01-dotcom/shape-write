// Proxy seguro: grava a CNH gerada na tabela `cnh` do app externo.
// A chave de escrita fica apenas no servidor, nunca no navegador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest } from "../_shared/auth.ts";

const EXTERNAL_URL = "https://mpiuedfqjtsrffdwwwfz.supabase.co";

// Chave de serviço do projeto externo (cofre). Nunca vai para o navegador.
const WRITE_KEY = Deno.env.get("CNH_EXTERNAL_SERVICE_KEY") ?? "";

// Token para sites parceiros que geram CNH e precisam gravar na mesma tabela.
const PARTNER_TOKEN = Deno.env.get("CNH_PARTNER_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WRITE_KEY) return json({ error: "missing_service_key" }, 500);

  // Dois caminhos de acesso: token de parceiro (outros sites) ou sessão logada.
  const partner = req.headers.get("x-partner-token") ?? "";
  const isPartner = PARTNER_TOKEN.length > 0 && partner === PARTNER_TOKEN;

  if (!isPartner) {
    if (partner) return json({ error: "invalid_partner_token" }, 401);
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth instanceof Response) return auth;
  }


  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const registros = Array.isArray(payload?.registros) ? payload.registros : null;
  if (!registros || registros.length === 0 || registros.length > 2) {
    return json({ error: "invalid_registros" }, 400);
  }
  for (const r of registros) {
    if (!r || typeof r !== "object" || !(r as Record<string, unknown>).cpf) {
      return json({ error: "invalid_registro" }, 400);
    }
  }

  try {
    const upstream = await fetch(`${EXTERNAL_URL}/rest/v1/cnh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: WRITE_KEY,
        Authorization: `Bearer ${WRITE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(registros),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error(`cnh-ingest upstream [${upstream.status}]:`, text.slice(0, 500));
      return json({ error: "upstream_error", status: upstream.status, detail: text.slice(0, 500) }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("cnh-ingest proxy failed:", err);
    return json({ error: String(err) }, 500);
  }
});
