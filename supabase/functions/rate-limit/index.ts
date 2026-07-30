import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, identifier } = await req.json();

    if (!identifier || typeof identifier !== "string") {
      return new Response(JSON.stringify({ error: "Missing identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Limpeza oportunista (não bloqueia a resposta)
    if (Math.random() < 0.05) {
      supabaseAdmin.rpc("cleanup_old_login_attempts").then(() => {}, () => {});
    }

    const isRegister = identifier.startsWith("register:");
    const windowMinutes = isRegister ? 60 : 15;
    const maxAttempts = isRegister ? 5 : 10;

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
        attempt_type: isRegister ? "register" : "login",
      });

    if (action === "check") {
      const count = await countAttempts();
      return new Response(
        JSON.stringify({ allowed: count < maxAttempts, remaining: Math.max(0, maxAttempts - count) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "check_and_record") {
      // Uma única viagem de rede: conta e registra em paralelo
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
