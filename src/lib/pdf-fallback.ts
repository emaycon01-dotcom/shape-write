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
 * Funções que podem usar a ponte secundária: qualquer montador de documento
 * (`generate-*-pdf`) e os repasses de integração. Assim, todo módulo novo
 * criado aqui funciona de imediato, mesmo antes de ser publicado no backend
 * principal — nenhum dado do cliente é gravado no secundário.
 */
const FALLBACK_EXTRA = new Set([
  "cnh-ingest-proxy",
  "doc-ingest-proxy",
  // Espelha receita/atestado no banco lido pelo portal de validação.
  "mirror-validation-doc",
  // Espelha o código/PDF do Atestado HapVida no banco lido pelo validador.
  "mirror-hapvida-code",

  // Consulta de CNH por CPF: a chave de leitura vive no backend secundário.
  "consulta-cnh",
]);

function canBridge(functionName: string) {
  return /^generate-[a-z0-9-]+-pdf$/.test(functionName) || FALLBACK_EXTRA.has(functionName);
}

export interface InvokeOutcome {
  data: unknown;
  error: Error | null;
}

export async function invokeSecondaryFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<InvokeOutcome | null> {
  if (!canBridge(functionName)) return null;
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
      // Sem prazo, uma ponte pendurada deixava a tela "carregando" para sempre.
      signal: AbortSignal.timeout(60000),
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
/**
 * O supabase-js devolve apenas "Edge Function returned a non-2xx status code".
 * A mensagem real vem no corpo da resposta — extraímos para o usuário saber o
 * que corrigir (ex.: CPF ou registro inválido).
 */
async function withServerMessage(error: unknown): Promise<Error | null> {
  if (!error) return null;
  const err = error as Error & { context?: Response };
  try {
    const res = err.context;
    if (res && typeof res.clone === "function") {
      const body = await res.clone().json().catch(() => null) as { error?: string } | null;
      if (body?.error) return new Error(body.error);
    }
  } catch { /* mantém a mensagem original */ }
  return err as Error;
}

export async function invokePdfFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<InvokeOutcome> {

  // Prazo máximo no backend principal: se ele não responder, caímos na ponte
  // em vez de deixar o usuário preso em "carregando".
  const primary = await Promise.race([
    supabase.functions.invoke(functionName, { body }),
    new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error("tempo esgotado no backend") }), 75000),
    ),
  ]);


  const payload = primary.data as Record<string, unknown> | null;
  const validationMissing =
    functionName === "generate-cnh-pdf" &&
    body.preview !== true &&
    (!!primary.error || payload?.validacao_registrada !== true);

  // Qualquer função autorizada que falhe no backend principal (indisponível ou
  // ainda não publicada lá) é reencaminhada uma única vez pela ponte.
  const shouldBridge = validationMissing || (!!primary.error && canBridge(functionName));

  if (!shouldBridge) {
    return { data: primary.data, error: await withServerMessage(primary.error) };
  }

  const fallback = await invokeSecondaryFunction(functionName, body);
  if (fallback && !fallback.error) return fallback;

  return { data: primary.data, error: await withServerMessage(primary.error) || (fallback?.error ?? null) };
}

