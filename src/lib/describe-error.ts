/**
 * Converte qualquer falha (Error, objeto do supabase-js, string) em um texto
 * curto e útil para o usuário/suporte. Evita mensagens vazias como
 * "Nenhum crédito foi descontado." sem nenhuma pista do motivo.
 */
export function describeError(e: unknown): string {
  if (!e) return "Falha desconhecida. Tente novamente.";
  if (typeof e === "string") return e;

  const err = e as { message?: string; name?: string; status?: number; error?: string; context?: { status?: number } };
  const parts: string[] = [];
  const msg = err.message || err.error || "";
  if (msg) parts.push(msg);
  const status = err.status ?? err.context?.status;
  if (status) parts.push(`HTTP ${status}`);
  if (!parts.length && err.name) parts.push(err.name);

  if (!parts.length) {
    try {
      const json = JSON.stringify(e);
      if (json && json !== "{}") parts.push(json.slice(0, 120));
    } catch { /* ignora */ }
  }

  if (!parts.length) return "Falha desconhecida. Verifique a conexão e tente novamente.";
  return parts.join(" · ").slice(0, 180);
}
