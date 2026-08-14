import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const MP_API = "https://api.mercadopago.com/v1";

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
    const auth = await authenticateRequest(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body?.transaction_id || "");
    const wantDebug = body?.debug === true;

    const targetUrl = Deno.env.get("MIGRATION_TARGET_URL");
    const targetKey = Deno.env.get("MIGRATION_TARGET_KEY");
    if (!targetUrl || !targetKey) return json({ error: "Backend financeiro não configurado" }, 500);
    const supabaseAdmin = createClient(targetUrl, targetKey, { auth: { persistSession: false } });

    let query = supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("user_id", auth.userId);

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
        _user_id: auth.userId,
        _cargo: "admin",
      });
      if (isAdmin) debug = { trace: [] };
    }

    const chargeId = transaction.elitepay_charge_id || transaction.txid || "";
    const isMercadoPago = transaction.gateway === "mercadopago" || /^\d{8,}$/.test(String(chargeId));
    let confirmed = false;
    if (isMercadoPago) {
      const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
      if (!accessToken) return json({ error: "Gateway não configurado" }, 500);
      const mpRes = await fetch(`${MP_API}/payments/${encodeURIComponent(String(chargeId))}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const mpData = await mpRes.json().catch(() => null);
      confirmed = mpRes.ok && String(mpData?.status || "").toLowerCase() === "approved";
    } else {
      confirmed = await confirmElitepayPayment(chargeId, debug);
    }
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
