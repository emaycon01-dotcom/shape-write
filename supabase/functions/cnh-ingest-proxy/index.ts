// Proxy seguro: grava a CNH gerada na tabela `cnh` do app externo.
// A chave de escrita fica apenas no servidor, nunca no navegador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateRequest } from "../_shared/auth.ts";

const EXTERNAL_URL = "https://mpiuedfqjtsrffdwwwfz.supabase.co";

// Chave de serviço do projeto externo (cofre). Enquanto não estiver
// configurada, cai na chave pública antiga para não quebrar a geração.
const SERVICE_KEY = Deno.env.get("CNH_EXTERNAL_SERVICE_KEY") ?? "";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1waXVlZGZxanRzcmZmZHd3d2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODU4MDAsImV4cCI6MjA4OTU2MTgwMH0._9TVZIsc6phpZtqGPipXURsJDsMcMIBhpfjdY2QuMa8";

const WRITE_KEY = SERVICE_KEY || FALLBACK_KEY;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Exige sessão válida: sem login não se grava nada no app externo.
  const auth = await authenticateRequest(req, corsHeaders);
  if (auth instanceof Response) return auth;

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
