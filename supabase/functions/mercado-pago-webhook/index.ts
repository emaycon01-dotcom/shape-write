// Webhook do Mercado Pago: recebe notificações e aplica créditos/plano automaticamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction } from "../_shared/elitepay.ts";

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
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("MERCADO_PAGO_ACCESS_TOKEN not configured");
      return json({ error: "Gateway não configurado" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    // O Mercado Pago envia dois formatos válidos:
    // { data: { id }, type: "payment" } e { resource, topic: "payment" }.
    const paymentId = body.data?.id || body.id || body.resource;
    const topic = (body.type || body.topic || "").toLowerCase();

    if (!paymentId) {
      console.error("Mercado Pago webhook missing payment id:", JSON.stringify(body));
      return json({ error: "Missing payment id" }, 400);
    }

    // Só processamos notificações de pagamento
    if (topic && topic !== "payment" && topic !== "merchant_order") {
      return json({ ok: true, message: "Ignored topic" });
    }

    const targetUrl = Deno.env.get("MIGRATION_TARGET_URL");
    const targetKey = Deno.env.get("MIGRATION_TARGET_KEY");
    if (!targetUrl || !targetKey) {
      return json({ error: "Backend financeiro não configurado" }, 500);
    }
    const supabaseAdmin = createClient(targetUrl, targetKey, {
      auth: { persistSession: false },
    });

    // Busca transação pelo ID do Mercado Pago
    const { data: transaction, error: findError } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("elitepay_charge_id", String(paymentId))
      .maybeSingle();

    if (findError) {
      console.error("DB find error:", findError);
      return json({ error: "Database error" }, 500);
    }

    // Sempre consulta a API do Mercado Pago para confirmar o status real
    const mpRes = await fetch(`${MP_API}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mpRes.ok) {
      console.error("Mercado Pago API error:", mpRes.status);
      return json({ error: "Gateway error" }, 502);
    }

    const mpData = await mpRes.json().catch(() => null);
    if (!mpData) {
      return json({ error: "Invalid gateway response" }, 502);
    }

    const status = String(mpData.status || "").toLowerCase();

    if (!transaction) {
      // Pagamento existe no MP mas ainda não temos transação local (ex: webhook chegou antes do insert)
      console.log("Mercado Pago webhook: transaction not found for payment", paymentId, "status", status);
      return json({ ok: true, message: "Transaction not found, ignored" });
    }

    if (transaction.status === "pago") {
      return json({ ok: true, message: "Already processed" });
    }

    if (status !== "approved") {
      await supabaseAdmin
        .from("financial_transactions")
        .update({ status })
        .eq("id", transaction.id)
        .neq("status", "pago");
      return json({ ok: true, status });
    }

    const applied = await applyPaidTransaction(supabaseAdmin, transaction);
    return json({ ok: true, status: "approved", applied });
  } catch (err) {
    console.error("Mercado Pago webhook error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
