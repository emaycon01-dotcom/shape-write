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
async function ensureFreshSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return false;
  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt - Date.now() < 120_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    return !!refreshed.session;
  }
  return true;
}

export async function createMercadoPagoPix(payload: MpPixPayload): Promise<MpPixResult> {
  const hasSession = await ensureFreshSession();
  if (!hasSession) {
    throw new Error("Sessão expirada. Entre novamente para gerar o PIX automático.");
  }

  const invoke = () => supabase.functions.invoke("create-mercado-pago-pix", { body: payload });

  let { data, error } = await invoke();

  // Uma segunda tentativa após renovar o token cobre 401 por token vencido em trânsito.
  if (error) {
    await supabase.auth.refreshSession();
    ({ data, error } = await invoke());
  }

  if (error) {
    const ctx = (error as { context?: { status?: number } }).context;
    if (ctx?.status === 401) {
      throw new Error("Sessão expirada. Entre novamente para gerar o PIX automático.");
    }
    throw new Error(error.message || "Falha ao gerar cobrança no Mercado Pago.");
  }

  if (data?.error) throw new Error(String(data.error));
  if (!data?.pix_code) throw new Error("O gateway não retornou o código PIX.");

  return data as MpPixResult;
}
