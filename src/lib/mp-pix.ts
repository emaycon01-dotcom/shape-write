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

  let response: Response;
  try {
    response = await callGateway(session.access_token);
  } catch {
    throw new Error("Não foi possível conectar ao servidor de pagamentos. Verifique sua internet e tente novamente.");
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
      throw new Error("Não foi possível conectar ao servidor de pagamentos. Verifique sua internet e tente novamente.");
    }
  }

  const data = await response.json().catch(() => null) as (MpPixResult & { error?: string }) | null;
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sessão expirada. Entre novamente para gerar o PIX automático.");
    throw new Error(data?.error || `Falha no servidor de pagamentos (${response.status}).`);
  }

  if (data?.error) throw new Error(String(data.error));
  if (!data?.pix_code) throw new Error("O gateway não retornou o código PIX.");

  return data as MpPixResult;
}
