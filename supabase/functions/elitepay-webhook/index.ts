import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

const ELITEPAY_BASE_URL = "https://api.elitepaybr.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function confirmElitepayPayment(chargeId: string): Promise<boolean> {
  const clientId = Deno.env.get("ELITEPAY_API_KEY");
  const clientSecret = Deno.env.get("ELITEPAY_SECRET_KEY");
  if (!clientId || !clientSecret) return false;

  try {
    const res = await fetch(`${ELITEPAY_BASE_URL}/api/v1/transactions`, {
      method: "GET",
      headers: { "x-client-id": clientId, "x-client-secret": clientSecret },
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    const list: any[] = data?.transactions || data?.data || [];
    const match = list.find((t) => t?.id === chargeId || t?.ourId === chargeId || t?.transactionId === chargeId);
    if (!match) return false;
    const status = String(match.status || "").toLowerCase();
    return ["aprovado", "completo", "concluido", "completed", "approved", "paid"].includes(status);
  } catch {
    return false;
  }
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

    const { data: updatedTx } = await supabaseAdmin
      .from("financial_transactions")
      .update({
        status: normalizedStatus,
        ...(normalizedStatus === "pago" ? { paid_at: new Date().toISOString() } : {}),
      })
      .eq("id", transaction.id)
      .neq("status", "pago")
      .select("id")
      .maybeSingle();

    if (!updatedTx) {
      return json({ ok: true, message: "Already processed" });
    }

    if (normalizedStatus === "pago") {
      const userId = transaction.user_id;

      if (transaction.type === "credito" && Number(transaction.credits_amount) > 0) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("user_id", userId)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({ credits: Number(profile.credits || 0) + Number(transaction.credits_amount) })
            .eq("user_id", userId)
            .eq("credits", profile.credits);
        }
      } else if (transaction.type === "plano" && transaction.plan_name) {
        const planMap: Record<string, string> = { Dealer: "dealer", Master: "master", Diamond: "diamond" };
        const planValue = planMap[transaction.plan_name] || String(transaction.plan_name).toLowerCase();

        await supabaseAdmin.from("profiles").update({ plano: planValue }).eq("user_id", userId);
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: userId, cargo: planValue, assigned_by: "system" },
          { onConflict: "user_id,cargo" },
        );
      }

      // Depósito confirmado: zera todas as advertências de PIX do usuário
      await supabaseAdmin
        .from("pix_warnings")
        .update({ status: "cleared", resolved_at: new Date().toISOString() })
        .eq("user_id", userId)
        .in("status", ["warning", "pending"]);

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name, email")
        .eq("user_id", userId)
        .maybeSingle();

      await supabaseAdmin.from("deposits").insert({
        user_id: userId,
        user_name: profile?.name || "",
        user_email: profile?.email || "",
        amount: transaction.amount,
        method: "pix_elitepay",
        status: "completed",
      });
    }

    return json({ ok: true, status: normalizedStatus });
  } catch (err) {
    console.error("Webhook error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
