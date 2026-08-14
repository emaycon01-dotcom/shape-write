import { supabase } from "@/integrations/supabase/client";

export interface MpPixResult {
  transaction_id: string;
  pix_code: string;
  qr_code_base64?: string;
  amount: number;
  status?: string;
}

export interface MpPixPayload {
  type: "credito" | "plano";
  amount: number;
  credits_amount?: number;
  plan_name?: string;
}

/**
 * Garante que a sessão esteja válida antes de chamar a função de pagamento.
 * A causa mais comum de "cair no PIX estático" era o token expirado: a função
 * respondia 401 e o cliente assumia que o gateway estava fora do ar.
 */
async function ensureFreshSession() {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session) return false;
  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() < 120_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session;
  }
  return session || false;
}

export async function createMercadoPagoPix(payload: MpPixPayload): Promise<MpPixResult> {
  let session = await ensureFreshSession();
  if (!session) {
    throw new Error("Sessão expirada. Entre novamente para gerar o PIX automático.");
  }

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mercado-pago-pix`;

  const callGateway = (accessToken: string) => fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Requisição "simples" (sem cabeçalhos customizados) — não dispara preflight
  // CORS, então funciona mesmo em navegadores/redes que bloqueiam o OPTIONS.
  const callGatewayNoPreflight = (accessToken: string) => fetch(functionUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ ...payload, access_token: accessToken }),
  });

  async function callViaSdk(accessToken: string): Promise<MpPixResult> {
    try {
      const { data, error } = await supabase.functions.invoke("create-mercado-pago-pix", { body: payload });
      if (error) throw new Error(error.message || "Falha no servidor de pagamentos.");
      return parse(data);
    } catch {
      const res = await callGatewayNoPreflight(accessToken);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data as { error?: string })?.error || `Falha no servidor de pagamentos (${res.status}).`);
      return parse(data);
    }
  }

  function parse(data: unknown): MpPixResult {
    const res = data as (MpPixResult & { error?: string }) | null;
    if (res?.error) throw new Error(String(res.error));
    if (!res?.pix_code) throw new Error("O gateway não retornou o código PIX.");
    return res;
  }

  let response: Response;
  try {
    response = await callGateway(session.access_token);
  } catch {
    return await callViaSdk(session.access_token);
  }

  if (response.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session || false;
    if (!session) {
      throw new Error("Sessão expirada. Entre novamente para gerar o PIX automático.");
    }
    try {
      response = await callGateway(session.access_token);
    } catch {
      return await callViaSdk(session.access_token);
    }
  }

  const data = await response.json().catch(() => null) as (MpPixResult & { error?: string }) | null;
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sessão expirada. Entre novamente para gerar o PIX automático.");
    throw new Error(data?.error || `Falha no servidor de pagamentos (${response.status}).`);
  }

  return parse(data);
}
