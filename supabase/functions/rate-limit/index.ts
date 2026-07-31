import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Identificador derivado do IP do chamador (nunca do e-mail enviado pelo cliente),
// impedindo que um atacante bloqueie a conta de outra pessoa.
async function clientKey(req: Request, kind: string): Promise<string> {
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const data = new TextEncoder().encode(`${kind}|${ip}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
  return `${kind}:${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, identifier: rawIdentifier } = await req.json();

    const isRegister =
      typeof rawIdentifier === "string" && rawIdentifier.startsWith("register:");
    const kind = isRegister ? "register" : "login";
    const identifier = await clientKey(req, kind);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Limpeza oportunista (não bloqueia a resposta)
    if (Math.random() < 0.05) {
      supabaseAdmin.rpc("cleanup_old_login_attempts").then(() => {}, () => {});
    }

    const windowMinutes = isRegister ? 60 : 15;
    const maxAttempts = isRegister ? 5 : 20;

    const countAttempts = async () => {
      const { count } = await supabaseAdmin
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("identifier", identifier)
        .gte("created_at", new Date(Date.now() - windowMinutes * 60 * 1000).toISOString());
      return count ?? 0;
    };

    const recordAttempt = () =>
      supabaseAdmin.from("login_attempts").insert({
        identifier,
        attempt_type: kind,
      });

    if (action === "check") {
      const count = await countAttempts();
      return new Response(
        JSON.stringify({ allowed: count < maxAttempts, remaining: Math.max(0, maxAttempts - count) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "check_and_record") {
      const [count] = await Promise.all([countAttempts(), recordAttempt()]);
      return new Response(
        JSON.stringify({ allowed: count < maxAttempts, remaining: Math.max(0, maxAttempts - count) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "record") {
      await recordAttempt();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
