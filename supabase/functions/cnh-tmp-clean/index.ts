// Rotina temporária: remove registros de teste da tabela externa `cnh`.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const EXTERNAL_URL = "https://mpiuedfqjtsrffdwwwfz.supabase.co";
const KEY = Deno.env.get("CNH_EXTERNAL_SERVICE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const res = await fetch(
    `${EXTERNAL_URL}/rest/v1/cnh?nome_completo=eq.TESTE%20PROXY%20PARCEIRO`,
    {
      method: "DELETE",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
    },
  );
  return new Response(
    JSON.stringify({ status: res.status, deleted: res.headers.get("content-range") }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
