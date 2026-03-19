import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple hash using Web Crypto API (SHA-256 + salt)
async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, pin } = await req.json();

    if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN deve ter exatamente 4 dígitos numéricos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit: max 5 PIN attempts per 15 minutes
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rateLimitId = `pin:${user.id}:${clientIp}`;

    // Cleanup old attempts
    await supabaseAdmin.rpc("cleanup_old_login_attempts");

    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", rateLimitId)
      .eq("attempt_type", "pin")
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record attempt
    await supabaseAdmin.from("login_attempts").insert({
      identifier: rateLimitId,
      attempt_type: "pin",
    });

    const salt = user.id.slice(0, 8);
    const pinHash = await hashPin(pin, salt);

    if (action === "set") {
      // Set/update PIN
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ pin_hash: pinHash })
        .eq("user_id", user.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Falha ao salvar PIN" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", user.id)
        .single();

      if (!profile?.pin_hash) {
        return new Response(JSON.stringify({ error: "PIN não configurado", needsSetup: true }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = profile.pin_hash === pinHash;
      if (!valid) {
        return new Response(JSON.stringify({ error: "PIN incorreto", valid: false }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check") {
      // Check if user has a PIN set
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("pin_hash")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ hasPin: !!profile?.pin_hash }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
