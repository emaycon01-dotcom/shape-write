import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STATE_MAP: Record<string, string> = {
  COMPLETO: "pago", CONCLUIDO: "pago", APROVADO: "pago", COMPLETED: "pago", APPROVED: "pago", PAID: "pago",
  PENDENTE: "gerado", PENDING: "gerado",
  PROCESSANDO: "processando", PROCESSING: "processando",
  FALHOU: "falhou", FAILED: "falhou", ERRO: "falhou", ERROR: "falhou",
  CANCELADO: "cancelado", CANCELLED: "cancelado",
  EXPIRADO: "expirado", EXPIRED: "expirado",
};

const EVENT_MAP: Record<string, string> = {
  DEPOSITO_COMPLETO: "pago",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const chargeId = body.transactionId || body.transaction?.transactionId || body.data?.transactionId || "";
    const transactionType = String(body.transactionType || body.type || "").toLowerCase();
    const rawStatus = String(
      body.status || body.transactionState || body.transaction?.transactionState || body.data?.transactionState || "",
    ).toUpperCase().replace(/\s/g, "");
    const event = String(body.event || "").toUpperCase();

    if (transactionType === "saque") {
      return json({ ok: true, message: "Saque ignorado" });
    }
    if (!chargeId) {
      console.error("No transactionId in webhook payload");
      return json({ error: "Missing transactionId" }, 400);
    }

    const normalizedStatus = EVENT_MAP[event] || STATE_MAP[rawStatus] || "gerado";

    const { data: transaction, error: findError } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("elitepay_charge_id", chargeId)
      .maybeSingle();

    if (findError || !transaction) {
      console.error("Transaction not found:", chargeId, findError);
      return json({ error: "Transaction not found" }, 404);
    }

    if (transaction.status === "pago") {
      return json({ ok: true, message: "Already processed" });
    }

    if (normalizedStatus === "pago") {
      const confirmed = await confirmElitepayPayment(chargeId);
      if (!confirmed) {
        console.warn("ElitePay confirmation failed; rejecting paid webhook:", chargeId);
        return json({ error: "Pagamento ainda não confirmado pelo gateway" }, 409);
      }
    }

    if (normalizedStatus !== "pago") {
      await supabaseAdmin
        .from("financial_transactions")
        .update({ status: normalizedStatus })
        .eq("id", transaction.id)
        .neq("status", "pago");
      return json({ ok: true, status: normalizedStatus });
    }

    const applied = await applyPaidTransaction(supabaseAdmin, transaction);
    return json({ ok: true, status: "pago", applied });
    return json({ ok: true, status: normalizedStatus });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
