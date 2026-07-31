import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body?.transaction_id || "");
    const wantDebug = body?.debug === true;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("user_id", authUser.id);

    query = transactionId
      ? query.eq("id", transactionId)
      : query.eq("status", "gerado").order("created_at", { ascending: false }).limit(1);

    const { data: transaction } = await query.maybeSingle();
    if (!transaction) return json({ error: "Transação não encontrada" }, 404);

    if (transaction.status === "pago") {
      return json({ status: "pago", applied: false });
    }

    // Só administradores podem inspecionar a resposta bruta do gateway
    let debug: { trace: unknown[] } | undefined;
    if (wantDebug) {
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: authUser.id,
        _cargo: "admin",
      });
      if (isAdmin) debug = { trace: [] };
    }

    const confirmed = await confirmElitepayPayment(transaction.elitepay_charge_id || "", debug);
    if (!confirmed) {
      return json({ status: transaction.status, applied: false, ...(debug ? { debug: debug.trace } : {}) });
    }

    const applied = await applyPaidTransaction(supabaseAdmin, transaction);
    return json({ status: "pago", applied, ...(debug ? { debug: debug.trace } : {}) });
  } catch (err) {
    console.error("check-pix-payment error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
