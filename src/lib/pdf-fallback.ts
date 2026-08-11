import { supabase } from "@/integrations/supabase/client";

/**
 * Repasse de emergência da geração de documentos.
 *
 * O backend principal (São Paulo) é o único usado para dados, contas e
 * arquivos. Porém a Edge Function da CNH depende de um token do portal de
 * validação; quando esse token está ausente/expirado lá, a geração falhava e o
 * cliente via "O validador não confirmou o cadastro".
 *
 * Nesses casos reenviamos APENAS a montagem do HTML/validação para o backend
 * secundário, que mantém o token válido. Nenhum dado do cliente é gravado lá:
 * histórico, créditos e PDFs continuam no backend principal.
 *
 * A URL e a chave abaixo são públicas (chave anônima), como a do backend
 * principal — nenhum segredo é exposto.
 */
const FALLBACK_URL = "https://doycwownddyxfqntifca.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWN3b3duZGR5eGZxbnRpZmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDYzMTYsImV4cCI6MjA4OTAyMjMxNn0.kpk695Xomza4QBmD8FtdkNSMmJS1bFQyc6YSuvxpEbI";

/**
 * Funções de integração que podem usar a ponte secundária. A CNH continua
 * gravada diretamente no sistema externo; este backend apenas protege e
 * encaminha a credencial de escrita, sem persistir os dados do cliente.
 */
const FALLBACK_ALLOWED = new Set([
  "generate-cnh-pdf",
  "cnh-ingest-proxy",
  "generate-atpv-pdf",
]);

export interface InvokeOutcome {
  data: unknown;
  error: Error | null;
}

export async function invokeSecondaryFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<InvokeOutcome | null> {
  if (!FALLBACK_ALLOWED.has(functionName)) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return null;

    const res = await fetch(`${FALLBACK_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: FALLBACK_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) {
      return null;
    }
    return { data: json, error: null };
  } catch (err) {
    console.warn("[PDF] repasse secundário falhou:", err);
    return null;
  }
}

/**
 * Chama a Edge Function no backend principal e, se ela falhar (erro de rede ou
 * validação não confirmada), tenta uma única vez o repasse secundário.
 */
export async function invokePdfFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<InvokeOutcome> {
  const primary = await supabase.functions.invoke(functionName, { body });

  const payload = primary.data as Record<string, unknown> | null;
  const validationMissing =
    functionName === "generate-cnh-pdf" &&
    body.preview !== true &&
    (!!primary.error || payload?.validacao_registrada !== true);

  if (!validationMissing) {
    return { data: primary.data, error: (primary.error as Error) || null };
  }

  const fallback = await invokeSecondaryFunction(functionName, body);
  if (fallback) return fallback;

  return { data: primary.data, error: (primary.error as Error) || null };
}
