// Resolução pública de código de validação -> signed URL de curta duração.
// Chamada pelo site de validação (https://api-hapvida.xyz) via fetch do navegador.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://api-hapvida.xyz",
  "https://www.api-hapvida.xyz",
];

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const CODE_RE = /^[A-Za-z0-9_-]{8,128}$/;

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
    }

    const id = (body as { id?: unknown })?.id;
    if (typeof id !== "string" || !CODE_RE.test(id)) {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supabase
      .from("document_codes")
      .select("storage_path, revoked, doc_id")
      .eq("code", id)
      .maybeSingle();

    if (error) {
      console.error("lookup error", error);
      return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers });
    }

    if (!row || row.revoked) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
    }

    // O documento precisa continuar ativo e não expirado
    const { data: doc } = await supabase
      .from("documents")
      .select("status, expires_at")
      .eq("id", row.doc_id)
      .maybeSingle();

    if (doc && (doc.status !== "ativo" || new Date(doc.expires_at).getTime() <= Date.now())) {
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("documents-pdf")
      .createSignedUrl(row.storage_path, 600);

    if (signErr || !signed?.signedUrl) {
      console.error("sign error", signErr);
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers });
    }

    return new Response(JSON.stringify({ url: signed.signedUrl }), { status: 200, headers });
  } catch (err) {
    console.error("unexpected", err);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers });
  }
});
