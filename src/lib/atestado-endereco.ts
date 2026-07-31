/**
 * Divide o endereço em exatamente 3 linhas:
 *  1) logradouro + número
 *  2) bairro - cidade – UF
 *  3) CEP
 *
 * Respeita as quebras de linha digitadas/coladas. Se o cliente colar tudo em
 * uma linha só (ou em duas), o texto é redistribuído automaticamente.
 */
export function splitEndereco(raw: string): [string, string, string] {
  const linhas = (raw || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Já veio com 3 (ou mais) linhas: mantém exatamente como foi colado.
  if (linhas.length >= 3) {
    return [linhas[0], linhas[1], linhas.slice(2).join(" ")];
  }

  let texto = linhas.join(" ").replace(/\s+/g, " ").trim();
  if (!texto) return ["", "", ""];

  // ---- 3ª linha: CEP (em qualquer posição do texto) ----
  let cep = "";
  const cepMatch = texto.match(/(CEP:?\s*)?\b\d{5}-?\d{3}\b/i);
  if (cepMatch) {
    const num = cepMatch[0].replace(/CEP:?\s*/i, "").trim();
    const formatado = num.includes("-") ? num : `${num.slice(0, 5)}-${num.slice(5)}`;
    cep = `CEP: ${formatado}`;
    texto = (texto.slice(0, cepMatch.index) + " " + texto.slice(cepMatch.index! + cepMatch[0].length))
      .replace(/\s+/g, " ")
      .replace(/[\s,;–-]+$/, "")
      .replace(/^[\s,;–-]+/, "")
      .trim();
  }

  // Se restaram 2 linhas explícitas, a divisão já está pronta.
  if (linhas.length === 2 && linhas[1] && !/^\s*(CEP:?\s*)?\d{5}-?\d{3}\s*$/i.test(linhas[1])) {
    return [linhas[0], linhas[1].replace(/(CEP:?\s*)?\b\d{5}-?\d{3}\b/i, "").replace(/[\s,;–-]+$/, "").trim(), cep];
  }

  // ---- 1ª linha: logradouro + número | 2ª linha: bairro - cidade – UF ----
  let l1 = texto;
  let l2 = "";

  // Corta logo após o número do imóvel (primeiro número curto após o logradouro)
  const numMatch = texto.match(/^(.*?[,\s]\s*n?º?\.?\s*\d{1,6}[A-Za-z]?)\b[\s,;–-]*(.*)$/i);
  if (numMatch && numMatch[2]) {
    l1 = numMatch[1].replace(/[\s,;–-]+$/, "").trim();
    l2 = numMatch[2].trim();
  } else {
    const parts = texto.split(/\s*,\s*/);
    if (parts.length > 1) {
      l1 = parts[0].trim();
      l2 = parts.slice(1).join(", ").trim();
    }
  }

  return [l1, l2.replace(/^[\s,;–-]+/, "").trim(), cep];
}
