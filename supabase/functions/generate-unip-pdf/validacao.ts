import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** Página oficial de consulta do diploma digital da UNIP. */
export const UNIP_VALIDACAO_URL = "https://www.unip.br/aluno/diploma-digital";

/** QR Code vetorial (SVG) denso — nítido em qualquer resolução do PDF. */
export function qrSvg(value: string, sizePx: number): string {
  const MIN_TYPE = 8;
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = MIN_TYPE; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      // capacidade insuficiente — tenta a próxima versão
    }
  }
  if (!qr) {
    qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
  }
  const count = qr.getModuleCount();
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) rects += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${count} ${count}" shape-rendering="crispEdges"><rect width="${count}" height="${count}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}

/**
 * Código de validação determinístico no padrão UNIP: 322.322.xxxxxxxxxxxx
 * (o mesmo aluno + curso + registro sempre gera o mesmo código).
 */
export async function buildCodigoValidacao(seed: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `322.322.${hex.slice(0, 12)}`;
}

/** URL final embutida no QR Code do verso. */
export function buildValidationUrl(codigo: string): string {
  return `${UNIP_VALIDACAO_URL}?codigo=${encodeURIComponent(codigo)}`;
}
