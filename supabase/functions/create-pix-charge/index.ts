// PIX charge (Elite Pay) — redeploy v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { ELITEPAY_BASE_URL, applyPaidTransaction, confirmElitepayPayment } from "../_shared/elitepay.ts";

const PLAN_BASE_PRICES: Record<string, number> = { Basic: 150, Pro: 450, Premium: 999.99 };

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

    const ELITEPAY_CLIENT_ID = Deno.env.get("ELITEPAY_API_KEY");
    const ELITEPAY_CLIENT_SECRET = Deno.env.get("ELITEPAY_SECRET_KEY");
    if (!ELITEPAY_CLIENT_ID || !ELITEPAY_CLIENT_SECRET) {
      console.error("Elitepay credentials not configured");
      return json({ error: "Gateway de pagamento não configurado" }, 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reuse a recent pending charge (< 10 min) to avoid duplicates
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: existingCharge } = await supabaseAdmin
      .from("financial_transactions")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("type", type)
      .eq("amount", amount)
      .eq("status", "gerado")
      .gte("created_at", tenMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCharge?.pix_code) {
      if (existingCharge.elitepay_charge_id) {
        const confirmed = await confirmElitepayPayment(existingCharge.elitepay_charge_id);
        if (confirmed) {
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
      ? `${credits_amount} creditos - Bellarus`
      : `Plano ${plan_name} - Bellarus`;

    const elitepayResponse = await fetch(`${ELITEPAY_BASE_URL}/api/v1/deposit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": ELITEPAY_CLIENT_ID,
        "x-client-secret": ELITEPAY_CLIENT_SECRET,
      },
      body: JSON.stringify({
        amount,
        description,
        payerName: profile?.name || "Cliente Bellarus",
        payerDocument: "00000000000",
      }),
    });

    if (!elitepayResponse.ok) {
      console.error("Elitepay API error:", elitepayResponse.status, await elitepayResponse.text());
      return json({ error: "Erro ao criar cobrança no gateway" }, 502);
    }

    const chargeData = await elitepayResponse.json();
    if (!chargeData?.success) {
      console.error("Elitepay charge failed:", JSON.stringify(chargeData));
      return json({ error: "Falha ao gerar cobrança PIX" }, 502);
    }

    const transactionId = chargeData.transactionId || "";
    const qrCodeBase64 = chargeData.qrcodeUrl || "";
    const pixCode = chargeData.copyPaste || "";

    const { data: transaction, error: insertError } = await supabaseAdmin
      .from("financial_transactions")
      .insert({
        user_id: authUser.id,
        type,
        amount,
        credits_amount: credits_amount || 0,
        plan_name: plan_name || null,
        status: "gerado",
        txid: transactionId,
        elitepay_charge_id: transactionId,
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
