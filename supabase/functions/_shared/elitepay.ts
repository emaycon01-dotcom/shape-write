export const ELITEPAY_BASE_URL = "https://api.elitepaybr.com";

// A API da Elite Pay fica atrás do Cloudflare/Square Cloud. Requisições com
// User-Agent de navegador (sem fingerprint de navegador real) são tratadas
// como bot e recebem 403 "Request Blocked". Usamos UAs "de servidor" e
// tentamos algumas variações antes de desistir.
const UA_VARIANTS = [
  "curl/8.4.0",
  "MonkeyLab-Server/1.0",
  "PostmanRuntime/7.39.0",
];

export function elitepayHeaders(extra: Record<string, string> = {}, ua = UA_VARIANTS[0]): Record<string, string> {
  return {
    Accept: "*/*",
    "User-Agent": ua,
    ...extra,
  };
}

// Quando o WAF (Square Cloud/Cloudflare) bloqueia o IP do nosso runtime,
// podemos rotear as chamadas por um proxy próprio (Cloudflare Worker).
// Basta definir o secret ELITEPAY_PROXY_URL (e opcionalmente ELITEPAY_PROXY_TOKEN).
function proxyConfig() {
  const url = (Deno.env.get("ELITEPAY_PROXY_URL") || "").trim().replace(/\/+$/, "");
  const token = (Deno.env.get("ELITEPAY_PROXY_TOKEN") || "").trim();
  return { url, token };
}

async function attemptFetch(path: string, init: RequestInit & { headers?: Record<string, string> }, ua: string) {
  const { url: proxyUrl, token } = proxyConfig();
  const target = proxyUrl ? `${proxyUrl}${path}` : `${ELITEPAY_BASE_URL}${path}`;
  const extra: Record<string, string> = { ...(init.headers ?? {}) };
  if (proxyUrl && token) extra["x-proxy-token"] = token;
  return await fetch(target, { ...init, headers: elitepayHeaders(extra, ua) });
}

export async function elitepayFetch(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  let lastErr: unknown = null;
  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < UA_VARIANTS.length; attempt++) {
    try {
      const res = await attemptFetch(path, init, UA_VARIANTS[attempt]);
      if (res.status === 403 && attempt < UA_VARIANTS.length - 1) {
        console.warn("ElitePay 403 (WAF) com UA", UA_VARIANTS[attempt], "— tentando outra variação");
        lastRes = res;
        await res.body?.cancel().catch(() => {});
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  if (lastRes) return lastRes;
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
  // Uma única transação no banco aplica saldo/plano, registra o depósito e só
  // então marca a cobrança como paga. O bloqueio de linha evita crédito duplo.
  const { data, error } = await supabaseAdmin.rpc("apply_paid_financial_transaction", {
    _transaction_id: transaction.id,
  });
  if (error) {
    console.error("Falha atômica ao aplicar PIX:", transaction.id, error.message);
    throw new Error(`pix_apply_failed: ${error.message}`);
  }
  return data === true;
}
