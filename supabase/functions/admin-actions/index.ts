import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin (server-side, never trust the client)
    const { data: roles } = await admin
      .from("user_roles")
      .select("cargo")
      .eq("user_id", user.id);

    if (!roles?.some((r: { cargo: string }) => r.cargo === "admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const targetUserId = String(body.user_id ?? "");

    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return json({ error: "Invalid user_id" }, 400);
    }
    if (targetUserId === user.id) {
      return json({ error: "Você não pode executar esta ação na própria conta." }, 400);
    }

    if (action === "delete_user") {
      await admin.from("user_roles").delete().eq("user_id", targetUserId);
      await admin.from("blocked_users").delete().eq("user_id", targetUserId);
      await admin.from("profiles").delete().eq("user_id", targetUserId);
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "reset_pin") {
      await admin.from("profiles").update({ pin_hash: null }).eq("user_id", targetUserId);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_err) {
    return json({ error: "Internal error" }, 500);
  }
});
