/**
 * Divide o endereço em até 3 linhas.
 * Respeita quebras de linha digitadas; se o cliente colar tudo em uma linha só,
 * separa automaticamente: logradouro+nº / bairro - cidade - UF / CEP.
 */
export function splitEndereco(raw: string): [string, string, string] {
  const linhas = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length >= 2) {
    return [linhas[0] || "", linhas[1] || "", linhas.slice(2).join(" ")];
  }

  let texto = (linhas[0] || "").trim();
  let cep = "";
  const cepMatch = texto.match(/(CEP:?\s*)?\d{5}-?\d{3}\s*$/i);
  if (cepMatch) {
    const num = cepMatch[0].replace(/CEP:?\s*/i, "").trim();
    cep = `CEP: ${num}`;
    texto = texto.slice(0, cepMatch.index).replace(/[\s,;-]+$/, "").trim();
  }

  let l1 = texto;
  let l2 = "";
  const sep = texto.match(/^(.*?\d+[A-Za-z]?)\s*[-–,]\s*(.+)$/);
  if (sep) {
    l1 = sep[1].trim();
    l2 = sep[2].trim();
  } else {
    const parts = texto.split(/\s*,\s*/);
    if (parts.length > 1) {
      l1 = parts[0].trim();
      l2 = parts.slice(1).join(", ").trim();
    }
  }

  return [l1, l2, cep];
}
