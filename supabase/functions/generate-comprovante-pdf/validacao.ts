import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

/** QR Code vetorial (SVG) — usado no bloco "Pague via PIX". */
export function qrSvg(value: string, sizePx: number): string {
  let qr: ReturnType<typeof qrcode> | null = null;
  for (let type = 6; type <= 40; type++) {
    try {
      const candidate = qrcode(type, "M");
      candidate.addData(value);
      candidate.make();
      qr = candidate;
      break;
    } catch {
      /* capacidade insuficiente — tenta a próxima versão */
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

/* ------------------------------------------------- código de barras ITF */

const ITF: Record<string, string> = {
  "0": "nnwwn", "1": "wnnnw", "2": "nwnnw", "3": "wwnnn", "4": "nnwnw",
  "5": "wnwnn", "6": "nwwnn", "7": "nnnww", "8": "wnnwn", "9": "nwnwn",
};

/**
 * Código de barras "2 de 5 intercalado" (padrão da fatura/boleto) em SVG.
 * `digits` deve ter quantidade par de dígitos (44 no padrão bancário).
 */
export function itfBarcodeSvg(digits: string, widthPx: number, heightPx: number): string {
  const clean = (digits || "").replace(/\D/g, "");
  const even = clean.length % 2 === 0 ? clean : `0${clean}`;
  const NARROW = 1;
  const WIDE = 3;

  const bars: { w: number; dark: boolean }[] = [];
  // start: nnnn
  for (let i = 0; i < 4; i++) bars.push({ w: NARROW, dark: i % 2 === 0 });

  for (let i = 0; i < even.length; i += 2) {
    const a = ITF[even[i]] ?? ITF["0"];
    const b = ITF[even[i + 1]] ?? ITF["0"];
    for (let k = 0; k < 5; k++) {
      bars.push({ w: a[k] === "w" ? WIDE : NARROW, dark: true });
      bars.push({ w: b[k] === "w" ? WIDE : NARROW, dark: false });
    }
  }
  // stop: wnn
  bars.push({ w: WIDE, dark: true });
  bars.push({ w: NARROW, dark: false });
  bars.push({ w: NARROW, dark: true });

  const total = bars.reduce((s, b) => s + b.w, 0);
  let x = 0;
  let rects = "";
  for (const b of bars) {
    if (b.dark) rects += `<rect x="${x}" y="0" width="${b.w}" height="100"/>`;
    x += b.w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${total} 100" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="${total}" height="100" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
}
