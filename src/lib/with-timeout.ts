/**
 * Corre uma promessa com prazo máximo. Usado em chamadas de rede que não podem
 * travar a entrega do documento (espelhamentos, registros em validadores).
 * Em vez de rejeitar, resolve com `fallback` quando o prazo estoura.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
