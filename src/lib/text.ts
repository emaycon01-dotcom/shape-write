/** Utilitários de texto compartilhados pelos formulários. */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "na", "no"]);

/** "GESTÃO FINANCEIRA" → "Gestão Financeira" (preposições em minúsculo). */
export function titleCase(v: string): string {
  return v
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");
}

/** "30/01/1980" → "30 de janeiro de 1980" */
export function dataExtenso(v: string): string {
  const [d, m, y] = v.split("/");
  const mes = MESES[Number(m) - 1];
  if (!d || !mes || !y) return v;
  return `${Number(d)} de ${mes} de ${y}`;
}
