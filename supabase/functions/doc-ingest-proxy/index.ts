// Proxy seguro: encaminha documentos (rg/cha) para o app externo de consulta.
// O token de ingestão fica apenas no servidor, nunca no navegador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest } from "../_shared/auth.ts";

const TARGET_URL = "https://hfkckowhrjbpjgniaakl.supabase.co/functions/v1/doc-ingest";
const INGEST_TOKEN = Deno.env.get("DOC_INGEST_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!INGEST_TOKEN) return json({ error: "missing_ingest_token" }, 500);

  // Exige sessão válida: o token de ingestão nunca pode ser usado anonimamente.
  const auth = await authenticateRequest(req, corsHeaders);
  if (auth instanceof Response) return auth;

  let payload: { tabela?: string; dados?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const tabela = payload?.tabela;
  const dados = payload?.dados;
  if (tabela !== "rg" && tabela !== "cha") return json({ error: "invalid_tabela" }, 400);
  if (!dados || typeof dados !== "object" || !dados.documento_id) {
    return json({ error: "invalid_dados" }, 400);
  }

  try {
    const upstream = await fetch(TARGET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ingest-token": INGEST_TOKEN,
      },
      body: JSON.stringify({ tabela, dados }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error(`doc-ingest upstream [${upstream.status}]:`, text.slice(0, 500));
      return json({ error: "upstream_error", status: upstream.status, detail: text.slice(0, 500) }, 502);
    }
    return json({ ok: true, upstream: text.slice(0, 500) });
  } catch (err) {
    console.error("doc-ingest proxy failed:", err);
    return json({ error: String(err) }, 500);
  }
});
