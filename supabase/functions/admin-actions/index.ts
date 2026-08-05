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

    // Verify caller role (server-side, never trust the client)
    const { data: roles } = await admin
      .from("user_roles")
      .select("cargo")
      .eq("user_id", user.id);

    const cargos = (roles ?? []).map((r: { cargo: string }) => r.cargo);
    const isAdmin = cargos.includes("admin");
    const isGerente = cargos.includes("gerente");

    if (!isAdmin && !isGerente) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const targetUserId = String(body.user_id ?? "");

    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
      return json({ error: "Invalid user_id" }, 400);
    }
    if (targetUserId === user.id) {
      return json({ error: "Você não pode executar esta ação na própria conta." }, 400);
    }

    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("cargo")
      .eq("user_id", targetUserId);
    const targetIsStaff = (targetRoles ?? []).length > 0;

    const logAction = async (act: string, details: string) => {
      const [{ data: actorP }, { data: targetP }] = await Promise.all([
        admin.from("profiles").select("name,email").eq("user_id", user.id).maybeSingle(),
        admin.from("profiles").select("name,email").eq("user_id", targetUserId).maybeSingle(),
      ]);
      await admin.from("staff_action_logs").insert({
        actor_id: user.id,
        actor_name: actorP?.name ?? "",
        actor_email: actorP?.email ?? "",
        actor_cargo: isAdmin ? "admin" : "gerente",
        target_user_id: targetUserId,
        target_name: targetP?.name ?? "",
        target_email: targetP?.email ?? "",
        action: act,
        details,
      });
    };

    if (action === "delete_user") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      await logAction("delete_user", "Conta excluída definitivamente");
      await admin.from("user_roles").delete().eq("user_id", targetUserId);
      await admin.from("blocked_users").delete().eq("user_id", targetUserId);
      await admin.from("profiles").delete().eq("user_id", targetUserId);
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "set_password") {
      // Gerentes só podem alterar a senha de usuários comuns (sem cargo)
      if (!isAdmin && targetIsStaff) {
        return json(
          { error: "Gerentes só podem alterar a senha de usuários comuns." },
          403,
        );
      }
      const password = String(body.password ?? "");
      if (password.length < 6) {
        return json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(targetUserId, { password });
      if (error) return json({ error: error.message }, 500);
      const reason = String(body.reason ?? "").slice(0, 300);
      await logAction("set_password", reason || "Senha alterada");
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_err) {
    return json({ error: "Internal error" }, 500);
  }
});
