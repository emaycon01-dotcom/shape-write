import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TARGET_EMAIL = "auriunu@gmail.com";

Deno.serve(async () => {
  const url = Deno.env.get("MIGRATION_TARGET_URL");
  const key = Deno.env.get("MIGRATION_TARGET_KEY");
  if (!url || !key) return new Response("backend_unavailable", { status: 500 });

  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return new Response("lookup_failed", { status: 500 });

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === TARGET_EMAIL);
    if (user) {
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      return new Response(updateError ? "confirmation_failed" : "confirmed", {
        status: updateError ? 500 : 200,
      });
    }

    if (data.users.length < 200) break;
  }

  return new Response("not_found", { status: 404 });
});