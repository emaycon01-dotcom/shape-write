// Reconciliação automática de PIX: varre cobranças pendentes e aplica os
// pagamentos confirmados na Elite Pay, mesmo se o webhook falhar ou o cliente
// fechar a página antes do polling detectar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction, confirmElitepayPayments } from "../_shared/elitepay.ts";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pagamentos podem sofrer atraso no webhook; revisamos 30 dias para também
    // recuperar cobranças antigas que ficaram pendentes durante indisponibilidades.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const { data: pending, error } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .in("status", ["gerado", "processando"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("reconcile-pix query error:", error);
      return json({ error: "query_failed" }, 500);
    }

    let applied = 0;
    const results: Array<{ id: string; paid: boolean }> = [];

    const chargeIds = (pending ?? []).map((tx) => tx.elitepay_charge_id || "").filter(Boolean);
    const paidChargeIds = await confirmElitepayPayments(chargeIds);

    for (const tx of pending ?? []) {
      const chargeId = tx.elitepay_charge_id || "";
      if (!chargeId) continue;
      try {
        const confirmed = paidChargeIds.has(chargeId);
        if (confirmed) {
          const ok = await applyPaidTransaction(supabaseAdmin, tx);
          if (ok) applied++;
        }
        results.push({ id: tx.id, paid: confirmed });
      } catch (txError) {
        console.error("reconcile-pix transaction failed:", tx.id, txError);
        results.push({ id: tx.id, paid: false });
      }
    }

    console.log(`reconcile-pix: ${pending?.length ?? 0} pendentes, ${applied} aplicados`);
    return json({ ok: true, checked: pending?.length ?? 0, applied, results });
  } catch (err) {
    console.error("reconcile-pix error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
