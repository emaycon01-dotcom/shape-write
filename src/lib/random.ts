/** Utilitários de geração aleatória compartilhados pelos formulários. */

/** Sequência numérica com o comprimento informado (ex.: rnd(6) -> "402913"). */
export function rnd(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("");
}

/** Item aleatório de uma lista. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Minutos/segundos válidos (00–59) para horários gerados nos testes. */
export function rnd60(): string {
  return String(Math.floor(Math.random() * 60)).padStart(2, "0");
}
