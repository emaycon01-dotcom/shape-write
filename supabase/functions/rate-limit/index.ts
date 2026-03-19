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

    // Cleanup old attempts
    await supabaseAdmin.rpc("cleanup_old_login_attempts");

    if (action === "check") {
      // Check rate limit: max 10 login attempts per 15 min, max 5 register per hour
      const windowMinutes = identifier.startsWith("register:") ? 60 : 15;
      const maxAttempts = identifier.startsWith("register:") ? 5 : 10;

      const { count } = await supabaseAdmin
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("identifier", identifier)
        .gte("created_at", new Date(Date.now() - windowMinutes * 60 * 1000).toISOString());

      const allowed = (count ?? 0) < maxAttempts;
      const remaining = Math.max(0, maxAttempts - (count ?? 0));

      return new Response(JSON.stringify({ allowed, remaining }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "record") {
      await supabaseAdmin.from("login_attempts").insert({
        identifier,
        attempt_type: identifier.startsWith("register:") ? "register" : "login",
      });

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
