import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Confirma o e-mail de todas as contas existentes no backend de autenticação.
// O acesso continua controlado pela aprovação manual do perfil (status).
Deno.serve(async () => {
  const url = Deno.env.get("MIGRATION_TARGET_URL");
  const key = Deno.env.get("MIGRATION_TARGET_KEY");
  if (!url || !key) return new Response("backend_unavailable", { status: 500 });

  const admin = createClient(url, key, { auth: { persistSession: false } });

  let scanned = 0;
  let confirmed = 0;
  const failed: string[] = [];

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return new Response("lookup_failed", { status: 500 });

    for (const user of data.users) {
      scanned += 1;
      if (user.email_confirmed_at) continue;
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updateError) failed.push(user.email ?? user.id);
      else confirmed += 1;
    }

    if (data.users.length < 200) break;
  }

  return new Response(JSON.stringify({ scanned, confirmed, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
