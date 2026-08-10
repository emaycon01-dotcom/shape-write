export const ELITEPAY_BASE_URL = "https://api.elitepaybr.com";

// O WAF do provedor (Square Cloud) bloqueia requisições sem cabeçalhos de
// navegador. Mantemos um conjunto padrão para evitar 403 "Request Blocked".
export const ELITEPAY_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function elitepayHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "User-Agent": ELITEPAY_UA,
    Origin: "https://app.elitepaybr.com",
    Referer: "https://app.elitepaybr.com/",
    ...extra,
  };
}

export async function elitepayFetch(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${ELITEPAY_BASE_URL}${path}`, {
        ...init,
        headers: elitepayHeaders(init.headers ?? {}),
      });
      if (res.status === 403 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr ?? new Error("ElitePay unreachable");
}

const PAID_STATES = [
  "aprovado",
  "aprovada",
  "completo",
  "completa",
  "concluido",
  "concluida",
  "pago",
  "paga",
  "completed",
  "approved",
  "paid",
  "success",
  "succeeded",
  "deposito_completo",
];

function creds() {
  return {
    clientId: Deno.env.get("ELITEPAY_API_KEY") || "",
    clientSecret: Deno.env.get("ELITEPAY_SECRET_KEY") || "",
  };
}

function isPaidStatus(value: unknown): boolean {
  const s = String(value ?? "").toLowerCase().replace(/\s/g, "_");
  return PAID_STATES.includes(s);
}

function matchesCharge(t: any, chargeId: string): boolean {
  if (!t || typeof t !== "object") return false;
  const ids = [t.id, t.ourId, t.transactionId, t.transaction_id, t.externalId, t.idTransaction];
  return ids.some((v) => v && String(v) === chargeId);
}

function extractList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const key of ["transactions", "data", "items", "results", "records", "content"]) {
    const v = data[key];
    if (Array.isArray(v)) return v;
    if (v && Array.isArray(v.transactions)) return v.transactions;
    if (v && Array.isArray(v.data)) return v.data;
  }
  return [];
}

function statusOf(t: any): unknown {
  return t?.status ?? t?.transactionState ?? t?.state ?? t?.situacao ?? t?.paymentStatus;
}

async function apiGet(path: string): Promise<{ ok: boolean; status: number; body: any }> {
  const { clientId, clientSecret } = creds();
  if (!clientId || !clientSecret) return { ok: false, status: 0, body: null };
  try {
    const res = await elitepayFetch(path, {
      method: "GET",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
      },
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    console.error("ElitePay GET failed", path, e);
    return { ok: false, status: 0, body: null };
  }
}

/**
 * Confirma o pagamento de uma cobrança na Elite Pay.
 * Tenta o endpoint direto da transação e, em seguida, a listagem paginada.
 */
export async function confirmElitepayPayment(
  chargeId: string,
  debug?: { trace: unknown[] },
): Promise<boolean> {
  if (!chargeId) return false;

  // 1) Endpoints diretos
  const directPaths = [
    `/api/v1/transactions/${encodeURIComponent(chargeId)}`,
    `/api/v1/transaction/${encodeURIComponent(chargeId)}`,
    `/api/v1/deposit/${encodeURIComponent(chargeId)}`,
  ];
  for (const path of directPaths) {
    const r = await apiGet(path);
    debug?.trace.push({ path, status: r.status, body: r.body });
    if (!r.ok || !r.body) continue;
    const tx = r.body?.transaction || r.body?.data || r.body;
    if (tx && (matchesCharge(tx, chargeId) || tx.status || tx.transactionState)) {
      if (isPaidStatus(statusOf(tx))) return true;
    }
  }

  // 2) Listagem (com paginação simples)
  const listPaths = [
    `/api/v1/transactions?limit=100`,
    `/api/v1/transactions?page=1&limit=100`,
    `/api/v1/transactions`,
  ];
  for (const path of listPaths) {
    const r = await apiGet(path);
    debug?.trace.push({ path, status: r.status, count: extractList(r.body).length });
    if (!r.ok) continue;
    const list = extractList(r.body);
    const match = list.find((t) => matchesCharge(t, chargeId));
    if (match) {
      debug?.trace.push({ matched: match });
      return isPaidStatus(statusOf(match));
    }
  }

  return false;
}

/**
 * Aplica os efeitos de um pagamento confirmado: créditos, plano,
 * limpeza de advertências e registro do depósito. Idempotente.
 */
export async function applyPaidTransaction(supabaseAdmin: any, transaction: any): Promise<boolean> {
  if (!transaction || transaction.status === "pago") return false;

  const { data: updatedTx } = await supabaseAdmin
    .from("financial_transactions")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", transaction.id)
    .neq("status", "pago")
    .select("id")
    .maybeSingle();

  if (!updatedTx) return false;

  const userId = transaction.user_id;

  if (transaction.type === "credito" && Number(transaction.credits_amount) > 0) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      const { error: creditError } = await supabaseAdmin
        .from("profiles")
        .update({ credits: Number(profile.credits || 0) + Number(transaction.credits_amount) })
        .eq("user_id", userId);
      if (creditError) console.error("Falha ao creditar usuário:", creditError);
    }

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: userId,
      actor_id: "system",
      kind: "credit",
      amount: Number(transaction.credits_amount),
      balance_after: 0,
      reason: `pix_elitepay ${transaction.elitepay_charge_id || ""}`.trim(),
    });
  } else if (transaction.type === "plano" && transaction.plan_name) {
    const planMap: Record<string, string> = { Basic: "dealer", Pro: "master", Premium: "diamond" };
    const planValue = planMap[transaction.plan_name] || String(transaction.plan_name).toLowerCase();

    const { error: planError } = await supabaseAdmin
      .from("profiles")
      .update({ plano: planValue })
      .eq("user_id", userId);
    if (planError) console.error("Falha ao aplicar plano:", planError);

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

  return true;
}
