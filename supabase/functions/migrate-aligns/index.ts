// Função temporária: copia os alinhamentos de template para o projeto novo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const src = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const targetUrl = (Deno.env.get("MIGRATION_TARGET_URL") || "").replace(/\/+$/, "");
  const targetKey = Deno.env.get("MIGRATION_TARGET_KEY") || "";
  if (!targetUrl || !targetKey) {
    return new Response(JSON.stringify({ error: "target_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await src.from("template_alignments").select("doc_type,positions");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${targetUrl}/rest/v1/template_alignments?on_conflict=doc_type`, {
    method: "POST",
    headers: {
      apikey: targetKey,
      Authorization: `Bearer ${targetKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(data),
  });
  const body = await res.text();

  return new Response(JSON.stringify({ ok: res.ok, status: res.status, copied: data?.length ?? 0, body: body.slice(0, 500) }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
