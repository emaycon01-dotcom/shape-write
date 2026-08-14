import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async () => {
  const url = Deno.env.get("MIGRATION_TARGET_URL");
  const key = Deno.env.get("MIGRATION_TARGET_KEY");
  if (!url || !key) return new Response("missing config", { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const id = "213ff6b0-3cbb-4694-82c7-4a08281796b6";
  const { data: tx, error } = await db.from("financial_transactions").select("*").eq("id", id).single();
  if (error || !tx) return new Response("transaction not found", { status: 404 });
  if (tx.status === "pago") return new Response("already repaired");

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("credits").eq("user_id", tx.user_id).single();
  if (profileError || !profile) return new Response("profile not found", { status: 404 });

  // Três tentativas anteriores atualizaram o saldo antes de falhar ao gravar
  // uma coluna ausente. Mantém somente uma aplicação e registra a auditoria.
  const corrected = Number(profile.credits) - (2 * Number(tx.credits_amount));
  const reason = `pix_mercadopago ${tx.elitepay_charge_id}`;
  const { data: existingLog } = await db.from("credit_transactions")
    .select("id").eq("user_id", tx.user_id).eq("reason", reason).limit(1).maybeSingle();
  if (!existingLog) {
    const { error: fixError } = await db.from("profiles").update({ credits: corrected }).eq("user_id", tx.user_id);
    if (fixError) return new Response(`profile repair failed: ${fixError.message}`, { status: 500 });
    const { error: logError } = await db.from("credit_transactions").insert({
      user_id: tx.user_id, actor_id: "system", kind: "credit",
      amount: tx.credits_amount, balance_after: corrected, reason,
    });
    if (logError) return new Response(`log repair failed: ${logError.message}`, { status: 500 });
  }
  await db.from("financial_transactions").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", id);
  return new Response("repaired");
});