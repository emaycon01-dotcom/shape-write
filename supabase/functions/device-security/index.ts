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
    const body = await req.json();
    const { action, fingerprint, user_id, user_email, reason } = body;

    if (!fingerprint || typeof fingerprint !== "string" || fingerprint.length < 16) {
      return new Response(JSON.stringify({ error: "Invalid fingerprint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "check") {
      // Check if this device is banned
      const { data: banned } = await supabaseAdmin
        .from("banned_devices")
        .select("id, reason, banned_at")
        .eq("fingerprint", fingerprint)
        .maybeSingle();

      return new Response(JSON.stringify({
        banned: !!banned,
        reason: banned?.reason || null,
        banned_at: banned?.banned_at || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "report_violation") {
      // Só é possível reportar violação da própria sessão. Nunca aceitamos um
      // user_id vindo do cliente: isso permitiria banir contas de terceiros.
      let selfUserId: string | null = null;
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const supabaseUser = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabaseUser.auth.getUser();
        selfUserId = user?.id ?? null;
      }

      if (user_id && user_id !== selfUserId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record a security violation
      await supabaseAdmin.from("login_attempts").insert({
        identifier: `violation:${fingerprint}`,
        attempt_type: "violation",
      });

      // Count recent violations for this device (last hour)
      const { count } = await supabaseAdmin
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("identifier", `violation:${fingerprint}`)
        .eq("attempt_type", "violation")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

      const violationCount = count ?? 0;

      // Auto-ban after 3 violations in 1 hour
      if (violationCount >= 3) {
        await supabaseAdmin.from("banned_devices").upsert({
          fingerprint,
          user_id: selfUserId,
          user_email: selfUserId ? (user_email || "") : "",
          reason: reason || "Auto-ban: múltiplas violações de segurança detectadas",
          banned_by: "system",
        }, { onConflict: "fingerprint" });

        // Só bloqueia a conta do próprio autor autenticado da violação
        if (selfUserId) {
          const { data: existingBlock } = await supabaseAdmin
            .from("blocked_users")
            .select("id")
            .eq("user_id", selfUserId)
            .maybeSingle();

          if (!existingBlock) {
            await supabaseAdmin.from("blocked_users").insert({
              user_id: selfUserId,
              user_email: user_email || "",
              user_name: "",
              reason: "Auto-bloqueio: tentativa de burlar segurança do sistema",
              status: "bloqueado",
            });
          }
        }

        return new Response(JSON.stringify({
          banned: true,
          message: "Dispositivo banido por violações de segurança",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        banned: false,
        violations: violationCount,
        remaining: 3 - violationCount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ban") {
      // Manual ban (requires auth check - admin only)
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

      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check admin role
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: user.id,
        _cargo: "admin",
      });

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("banned_devices").upsert({
        fingerprint,
        user_id: user_id || null,
        user_email: user_email || "",
        reason: reason || "Banido manualmente por administrador",
        banned_by: user.id,
      }, { onConflict: "fingerprint" });

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
