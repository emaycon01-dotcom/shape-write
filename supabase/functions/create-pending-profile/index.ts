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

/**
 * Cria o perfil "pendente" do novo cadastro no backend principal (São Paulo).
 *
 * Necessário porque a confirmação de e-mail está ativa: o signUp não devolve
 * sessão, então o cliente não consegue inserir o próprio perfil (RLS) e a conta
 * nunca aparecia na fila de aprovação.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("MIGRATION_TARGET_URL");
  const key = Deno.env.get("MIGRATION_TARGET_KEY");
  if (!url || !key) return json({ error: "backend_unavailable" }, 500);

  const admin = createClient(url, key, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "create");

    if (action === "backfill") {
      let created = 0;
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message }, 500);
        const users = data?.users ?? [];
        if (users.length === 0) break;

        const ids = users.map((u) => u.id);
        const { data: existing } = await admin.from("profiles").select("user_id").in("user_id", ids);
        const have = new Set((existing ?? []).map((r: { user_id: string }) => r.user_id));

        const missing = users
          .filter((u) => !have.has(u.id))
          .map((u) => ({
            user_id: u.id,
            email: u.email ?? "",
            name: String((u.user_metadata as Record<string, unknown>)?.name ?? u.email ?? ""),
            credits: 0,
            plano: "free",
            status: "pendente",
            created_at: u.created_at,
          }));

        if (missing.length > 0) {
          const { error: insErr } = await admin.from("profiles").insert(missing);
          if (insErr) return json({ error: insErr.message }, 500);
          created += missing.length;
        }
        if (users.length < 200) break;
      }
      return json({ ok: true, created });
    }

    const userId = String(body.user_id ?? "");
    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim().slice(0, 100);

    if (!/^[0-9a-f-]{36}$/i.test(userId) || !email.includes("@")) {
      return json({ error: "invalid_payload" }, 400);
    }

    // O usuário precisa realmente existir no Auth e o e-mail precisa bater.
    const { data: found, error: findErr } = await admin.auth.admin.getUserById(userId);
    if (findErr || !found?.user) return json({ error: "user_not_found" }, 404);
    if ((found.user.email ?? "").toLowerCase() !== email.toLowerCase()) {
      return json({ error: "email_mismatch" }, 400);
    }

    // O acesso é controlado pela aprovação manual do perfil, não por links de
    // confirmação. Confirma o e-mail no mesmo backend em que a conta nasceu
    // para impedir que usuários já aprovados fiquem presos no login.
    if (!found.user.email_confirmed_at) {
      const { error: confirmErr } = await admin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      if (confirmErr) return json({ error: "email_confirmation_failed" }, 500);
    }

    const { data: existing } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return json({ ok: true, already: true });

    const { error } = await admin.from("profiles").insert({
      user_id: userId,
      email,
      name: name || email,
      credits: 0,
      plano: "free",
      status: "pendente",
    });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true });
  } catch (_err) {
    return json({ error: "internal_error" }, 500);
  }
});
