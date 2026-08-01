/** Máscaras de entrada reutilizáveis (pt-BR) */

const digits = (v: string) => v.replace(/\D/g, "");

/** 000.000.000-00 */
export function maskCPF(v: string) {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** 00.000.000/0000-00 */
export function maskCNPJ(v: string) {
  const d = digits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** CPF enquanto <= 11 dígitos, CNPJ acima disso */
export function maskCpfCnpj(v: string) {
  return digits(v).length > 11 ? maskCNPJ(v) : maskCPF(v);
}

/** DD/MM/AAAA */
export function maskDate(v: string) {
  const d = digits(v).slice(0, 8);
  return d.replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
}

/** HH:MM */
export function maskTime(v: string) {
  const d = digits(v).slice(0, 4);
  return d.replace(/^(\d{2})(\d)/, "$1:$2");
}

/** HH:MM:SS */
export function maskTimeSec(v: string) {
  const d = digits(v).slice(0, 6);
  return d.replace(/^(\d{2})(\d)/, "$1:$2").replace(/^(\d{2}):(\d{2})(\d)/, "$1:$2:$3");
}

/** (00) 00000-0000 */
export function maskPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

/** 00000-000 */
export function maskCEP(v: string) {
  return digits(v).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

/** Apenas dígitos, com limite opcional */
export const maskDigits = (max?: number) => (v: string) =>
  max ? digits(v).slice(0, max) : digits(v);

/** Letras e números em maiúsculo, com limite opcional */
export const maskAlnumUpper = (max?: number) => (v: string) => {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return max ? s.slice(0, max) : s;
};

/** Números decimais (aceita vírgula ou ponto) */
export function maskDecimal(v: string) {
  return v.replace(/[^\d.,]/g, "").replace(/[.,]/g, ".").replace(/^(\d*\.?\d*).*$/, "$1");
}
