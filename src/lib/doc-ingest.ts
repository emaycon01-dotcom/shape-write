import { supabase } from "@/integrations/supabase/client";
import { invokeSecondaryFunction } from "@/lib/pdf-fallback";

/**
 * Envio de RG/CHA para o app externo de consulta.
 *
 * Fluxo: `doc-ingest-proxy` no backend principal e, se ele falhar (função sem
 * token, rede instável no celular, tempo esgotado), uma única tentativa pela
 * ponte secundária. O erro real é devolvido para que a tela mostre o motivo em
 * vez de "veja o console".
 */
export type DocIngestTable = "rg" | "cha";

export interface DocIngestResult {
  ok: boolean;
  error?: string;
}

function readError(data: unknown): string | null {
  if (data && typeof data === "object") {
    const d = data as { error?: unknown; detail?: unknown };
    if (d.error) return String(d.detail ?? d.error);
  }
  return null;
}

async function sendOnce(
  tabela: DocIngestTable,
  dados: Record<string, unknown>,
): Promise<DocIngestResult> {
  const body = { tabela, dados };

  let primaryError = "";
  try {
    const { data, error } = await supabase.functions.invoke("doc-ingest-proxy", { body });
    if (error) primaryError = error.message;
    else {
      const failure = readError(data);
      if (!failure) return { ok: true };
      primaryError = failure;
    }
  } catch (err) {
    primaryError = String(err);
  }

  // Ponte secundária: o backend antigo mantém o token de ingestão válido.
  const bridged = await invokeSecondaryFunction("doc-ingest-proxy", body);
  if (bridged && !readError(bridged.data)) return { ok: true };

  return { ok: false, error: primaryError || "envio recusado pelo app de consulta" };
}

export async function sendDocIngest(
  tabela: DocIngestTable,
  dados: Record<string, unknown>,
  attempts = 3,
): Promise<DocIngestResult> {
  let last: DocIngestResult = { ok: false, error: "envio não realizado" };
  for (let i = 1; i <= attempts; i++) {
    last = await sendOnce(tabela, dados);
    if (last.ok) return last;
    console.error(`${tabela.toUpperCase()} sync tentativa ${i} falhou:`, last.error);
    if (i < attempts) await new Promise((r) => setTimeout(r, 1200 * i));
  }
  return last;
}

/** Versão leve do registro (sem imagens) — cabe na fila do navegador. */
export function stripImages(dados: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (/^parte[1-4]$/.test(k)) continue;
    copy[k] = v;
  }
  return copy;
}
