/**
 * Chave de idempotência da cobrança.
 * O mesmo documento (mesmo tipo + mesmos dados) gerado de novo dentro de 12h
 * não desconta crédito outra vez — evita cobrança dupla em clique duplo,
 * retry após erro de rede ou nova tentativa depois de uma falha de envio.
 */
export function creditRef(reason: string, data: unknown): string {
  let payload = "";
  try {
    payload = JSON.stringify(data ?? {});
  } catch {
    payload = String(data ?? "");
  }
  // Hash simples (FNV-1a) — suficiente para diferenciar documentos.
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${reason}:${hash.toString(36)}:${payload.length.toString(36)}`;
}
