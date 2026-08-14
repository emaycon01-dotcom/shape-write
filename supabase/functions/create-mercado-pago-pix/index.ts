// Cria cobrança PIX via Mercado Pago e registra transação financeira pendente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { applyPaidTransaction } from "../_shared/elitepay.ts";

const PLAN_BASE_PRICES: Record<string, number> = { Basic: 150, Pro: 450, Premium: 999.99 };
const MP_API = "https://api.mercadopago.com/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidPurchase(type: string, amount: number, creditsAmount?: number, planName?: string): boolean {
  if (type === "credito") {
    if (!Number.isInteger(creditsAmount) || (creditsAmount as number) <= 0 || (creditsAmount as number) > 1000) return false;
    if (amount < 1 || amount > 15000) return false;
    const perUnit = amount / (creditsAmount as number);
    return perUnit >= 8 && perUnit <= 25;
  }
  if (type === "plano") {
    if (!planName || !(planName in PLAN_BASE_PRICES)) return false;
    return Math.abs(amount - PLAN_BASE_PRICES[planName]) < 0.01;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user: authUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authUser) {
      return json({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { type, amount, credits_amount, plan_name } = body ?? {};

    if (!type || typeof amount !== "number" || amount <= 0) {
      return json({ error: "Dados inválidos" }, 400);
    }
    if (type !== "credito" && type !== "plano") {
      return json({ error: "Tipo inválido" }, 400);
    }
    if (!isValidPurchase(type, amount, credits_amount, plan_name)) {
      return json({ error: "Pacote inválido" }, 400);
    }

    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("MERCADO_PAGO_ACCESS_TOKEN not configured");
      return json({ error: "Gateway de pagamento não configurado" }, 500);
    }
    console.log("Mercado Pago token present, length:", accessToken.length, "prefix:", accessToken.slice(0, 10));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reutiliza cobrança recente (< 10 min) para evitar duplicados
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: existingCharge } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("type", type)
      .eq("amount", amount)
      .eq("status", "gerado")
      .eq("gateway", "mercado_pago")
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCharge?.pix_code) {
      if (existingCharge.gateway_charge_id) {
        const paid = await checkMercadoPagoPayment(existingCharge.gateway_charge_id, accessToken);
        if (paid) {
          await applyPaidTransaction(supabaseAdmin, existingCharge);
          existingCharge.status = "pago";
        }
      }
      return json({
        transaction_id: existingCharge.id,
        pix_code: existingCharge.pix_code,
        qr_code_base64: existingCharge.qr_code_base64 || "",
        amount,
        status: existingCharge.status || "gerado",
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("user_id", authUser.id)
      .maybeSingle();

    const description = type === "credito"
      ? `${credits_amount} creditos - MonkeyLab`
      : `Plano ${plan_name} - MonkeyLab`;

    const projectHost = Deno.env.get("SUPABASE_URL")?.replace("https://", "");
    const notificationUrl = projectHost
      ? `https://${projectHost}/functions/v1/mercado-pago-webhook`
      : "";

    const firstName = (profile?.name || "Cliente").split(" ")[0];

    const mpResponse = await fetch(`${MP_API}/payments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        notification_url: notificationUrl,
        payer: {
          email: profile?.email || "cliente@monkeylab.app",
          first_name: firstName,
          last_name: "",
          identification: { type: "CPF", number: "00000000000" },
        },
      }),
    });

    const mpBody = await mpResponse.json().catch(() => null);
    if (!mpResponse.ok || !mpBody) {
      console.error("Mercado Pago API error:", mpResponse.status, JSON.stringify(mpBody));
      return json({ error: "Erro ao criar cobrança no gateway" }, 502);
    }

    const paymentId = String(mpBody.id || "");
    const txData = mpBody.point_of_interaction?.transaction_data || {};
    const pixCode = txData.qr_code || "";
    const qrCodeBase64 = txData.qr_code_base64 || "";

    if (!paymentId || !pixCode) {
      console.error("Mercado Pago missing payment data:", JSON.stringify(mpBody));
      return json({ error: "Resposta incompleta do gateway" }, 502);
    }

    const { data: transaction, error: insertError } = await supabaseAdmin
      .from("financial_transactions")
      .insert({
        user_id: authUser.id,
        type,
        amount,
        credits_amount: credits_amount || 0,
        plan_name: plan_name || null,
        status: "gerado",
        txid: paymentId,
        gateway: "mercado_pago",
        gateway_charge_id: paymentId,
        pix_code: pixCode,
        qr_code_base64: qrCodeBase64,
      })
      .select()
      .single();

    if (insertError) {
      console.error("DB insert error:", insertError);
      return json({ error: "Erro ao registrar transação" }, 500);
    }

    return json({
      transaction_id: transaction.id,
      pix_code: pixCode,
      qr_code_base64: qrCodeBase64,
      amount,
      status: "gerado",
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});

async function checkMercadoPagoPayment(paymentId: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${MP_API}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.status === "approved";
  } catch (e) {
    console.error("checkMercadoPagoPayment failed:", e);
    return false;
  }
}
