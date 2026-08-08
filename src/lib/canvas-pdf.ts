/**
 * Motor de geração CANVAS + jsPDF (100% no navegador).
 *
 * Diferente do motor antigo (html2canvas-pro), aqui o HTML das Edge Functions
 * não é "fotografado": ele é LIDO (layout real do navegador, via getClientRects
 * e getComputedStyle) e REDESENHADO diretamente num `<canvas>` 2D na resolução
 * final. O texto vira `fillText` na escala de saída — ou seja, nitidez de
 * verdade em vez de um bitmap ampliado — e o custo por geração cai muito,
 * porque não há clone do DOM a cada faixa.
 *
 * As coordenadas continuam sendo exatamente as mesmas: quem posiciona é o
 * próprio layout do HTML montado pelas Edge Functions.
 */
import {
  adoptFontFaces,
  blobToDataUrl,
  createHiddenFrame,
  waitForAssets,
} from "@/lib/browser-pdf";

/** 794px (A4 @96dpi) * 6 ≈ 4764px ≈ 576 DPI. */
const FINAL_SCALE = 6;

/* ------------------------------------------------------------------ *
 * Capacidades do aparelho
 * ------------------------------------------------------------------ */

let cachedMaxDim: number | null = null;
function maxCanvasDimension(): number {
  if (cachedMaxDim !== null) return cachedMaxDim;
  for (const size of [16384, 11180, 8192, 4096]) {
    try {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = 32;
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#f00";
      ctx.fillRect(size - 2, 0, 2, 2);
      const ok = ctx.getImageData(size - 1, 1, 1, 1).data[0] === 255;
      c.width = 0;
      c.height = 0;
      if (ok) {
        cachedMaxDim = size;
        return size;
      }
    } catch {
      /* tenta o próximo */
    }
  }
  cachedMaxDim = 4096;
  return 4096;
}

function deviceMemoryGb(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 ? nav.deviceMemory : 4;
}

function isWeakDevice(): boolean {
  const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  return mobile || (navigator.hardwareConcurrency || 4) <= 4 || deviceMemoryGb() <= 4;
}

/** Preview: desenhar em canvas é barato, então podemos manter mais nitidez. */
function previewScale(): number {
  const gb = deviceMemoryGb();
  if (gb <= 2) return 3;
  if (isWeakDevice()) return 4;
  return FINAL_SCALE;
}

function jpegQuality(): number {
  const gb = deviceMemoryGb();
  if (gb <= 2) return 0.9;
  if (isWeakDevice()) return 0.94;
  return 0.96;
}

/* ------------------------------------------------------------------ *
 * Lista de desenho
 * ------------------------------------------------------------------ */

type Rect = { x: number; y: number; w: number; h: number };
type Matrix = [number, number, number, number, number, number];

type BaseItem = {
  z: number;
  order: number;
  clip: Rect | null;
  matrix: Matrix | null;
  /** Caixa aproximada (já sem transform) para descartar itens fora da faixa. */
  bounds: Rect;
};

type FillItem = BaseItem & { kind: "fill"; rect: Rect; color: string };
type ImageItem = BaseItem & {
  kind: "image";
  source: CanvasImageSource;
  sw: number;
  sh: number;
  rect: Rect;
  fit: string;
};
type TextItem = BaseItem & {
  kind: "text";
  text: string;
  x: number;
  baseline: number;
  font: string;
  color: string;
  letterSpacing: number;
};

type Item = FillItem | ImageItem | TextItem;

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function isIdentity(m: Matrix) {
  return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0;
}

function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function parseMatrix(value: string): Matrix | null {
  if (!value || value === "none") return null;
  const nums = value.match(/-?[\d.e+]+/g);
  if (!nums) return null;
  const n = nums.map(Number);
  if (value.startsWith("matrix3d") && n.length === 16) {
    return [n[0], n[1], n[4], n[5], n[12], n[13]];
  }
  if (n.length >= 6) return [n[0], n[1], n[2], n[3], n[4], n[5]];
  return null;
}

function intersect(a: Rect | null, b: Rect): Rect {
  if (!a) return b;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, bt - y) };
}

function transformedBounds(rect: Rect, m: Matrix | null): Rect {
  if (!m) return rect;
  const pts = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/* ------------------------------------------------------------------ *
 * Leitura do layout
 * ------------------------------------------------------------------ */

function isTransparent(color: string) {
  return !color || color === "transparent" || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(color);
}

function fontShorthand(cs: CSSStyleDeclaration) {
  const style = cs.fontStyle && cs.fontStyle !== "normal" ? `${cs.fontStyle} ` : "";
  const weight = cs.fontWeight && cs.fontWeight !== "400" ? `${cs.fontWeight} ` : "";
  return `${style}${weight}${parseFloat(cs.fontSize) || 12}px ${cs.fontFamily}`;
}

/** Serializa um <svg> inline num bitmap de alta resolução (QR Codes). */
function svgToImage(svg: SVGElement, w: number, h: number, scale: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGElement;
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("viewBox")) {
    const vw = clone.getAttribute("width") || String(w);
    const vh = clone.getAttribute("height") || String(h);
    clone.setAttribute("viewBox", `0 0 ${parseFloat(vw) || w} ${parseFloat(vh) || h}`);
  }
  clone.setAttribute("width", String(Math.max(1, Math.round(w * scale))));
  clone.setAttribute("height", String(Math.max(1, Math.round(h * scale))));

  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao rasterizar o QR Code."));
    };
    img.src = url;
  });
}

/**
 * Divide o conteúdo de um nó de texto nas linhas REAIS montadas pelo navegador
 * (respeita quebra automática, `white-space`, alinhamento e centralização).
 */
function textLines(node: Text, origin: DOMRect): { text: string; rect: Rect }[] {
  const doc = node.ownerDocument;
  const range = doc.createRange();
  range.selectNodeContents(node);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  const raw = node.nodeValue || "";
  if (rects.length === 0) return [];

  const rel = (r: DOMRect | Rect & { left?: number; top?: number }) => r;
  void rel;

  if (rects.length === 1) {
    const r = rects[0];
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return [];
    return [
      { text: raw.trim() === raw ? raw : text, rect: { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height } },
    ];
  }

  // Texto quebrado em várias linhas: agrupa caractere a caractere.
  const lines: { text: string; rect: Rect }[] = [];
  let current: { chars: string[]; left: number; right: number; top: number; bottom: number } | null = null;

  for (let i = 0; i < raw.length; i += 1) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    if (!r || (r.width === 0 && r.height === 0)) continue;
    if (!current || Math.abs(r.top - current.top) > 1) {
      if (current) {
        lines.push({
          text: current.chars.join("").trim(),
          rect: {
            x: current.left - origin.left,
            y: current.top - origin.top,
            w: current.right - current.left,
            h: current.bottom - current.top,
          },
        });
      }
      current = { chars: [], left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }
    current.chars.push(raw[i]);
    current.left = Math.min(current.left, r.left);
    current.right = Math.max(current.right, r.right);
    current.bottom = Math.max(current.bottom, r.bottom);
  }
  if (current) {
    lines.push({
      text: current.chars.join("").trim(),
      rect: {
        x: current.left - origin.left,
        y: current.top - origin.top,
        w: current.right - current.left,
        h: current.bottom - current.top,
      },
    });
  }
  return lines.filter((l) => l.text.length > 0);
}

/**
 * Percorre a página e devolve a lista de desenho, em coordenadas CSS relativas
 * ao topo/esquerda da própria página.
 */
async function buildItems(page: HTMLElement, scale: number): Promise<{ items: Item[]; width: number; height: number }> {
  const win = page.ownerDocument.defaultView!;
  const origin = page.getBoundingClientRect();

  // Os transforms precisam ser desligados ANTES de medir: com eles ligados o
  // navegador devolve a caixa já rotacionada e o texto sairia torto. Guardamos
  // a matriz de cada elemento e reaplicamos na hora de desenhar.
  const transformed: { el: HTMLElement; matrix: Matrix; ox: number; oy: number; prev: string }[] = [];
  page.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const cs = win.getComputedStyle(el);
    const m = parseMatrix(cs.transform);
    if (!m || isIdentity(m)) return;
    const [oxRaw, oyRaw] = cs.transformOrigin.split(" ");
    transformed.push({
      el,
      matrix: m,
      ox: parseFloat(oxRaw) || 0,
      oy: parseFloat(oyRaw) || 0,
      prev: el.style.transform,
    });
    el.style.transform = "none";
  });

  const matrixFor = new Map<HTMLElement, { matrix: Matrix; ox: number; oy: number }>();
  transformed.forEach((t) => matrixFor.set(t.el, { matrix: t.matrix, ox: t.ox, oy: t.oy }));

  const items: Item[] = [];
  let order = 0;
  const pending: Promise<void>[] = [];

  const boxOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
  };

  const walk = (el: HTMLElement, clip: Rect | null, matrix: Matrix | null, z: number) => {
    const cs = win.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity || "1") === 0) return;

    const box = boxOf(el);
    let localMatrix = matrix;
    const own = matrixFor.get(el);
    if (own) {
      const px = box.x + own.ox;
      const py = box.y + own.oy;
      // translate(origem) * M * translate(-origem)
      const about = multiply(
        [1, 0, 0, 1, px, py],
        multiply(own.matrix, [1, 0, 0, 1, -px, -py]),
      );
      localMatrix = matrix ? multiply(matrix, about) : about;
    }

    let localClip = clip;
    if (cs.overflow === "hidden" || cs.overflow === "clip" || cs.contain === "strict") {
      localClip = intersect(clip, box);
    }

    let localZ = z;
    if (cs.position !== "static" && cs.zIndex !== "auto") {
      const parsed = parseInt(cs.zIndex, 10);
      if (!Number.isNaN(parsed)) localZ = parsed;
    }

    const push = (item: Item) => {
      items.push(item);
    };

    if (!isTransparent(cs.backgroundColor) && box.w > 0 && box.h > 0) {
      push({
        kind: "fill",
        rect: box,
        color: cs.backgroundColor,
        z: localZ,
        order: order++,
        clip: localClip,
        matrix: localMatrix,
        bounds: transformedBounds(box, localMatrix),
      });
    }

    const tag = el.tagName.toLowerCase();

    if (tag === "img") {
      const img = el as HTMLImageElement;
      if (img.naturalWidth > 0 && box.w > 0 && box.h > 0) {
        push({
          kind: "image",
          source: img,
          sw: img.naturalWidth,
          sh: img.naturalHeight,
          rect: box,
          fit: cs.objectFit || "fill",
          z: localZ,
          order: order++,
          clip: localClip,
          matrix: localMatrix,
          bounds: transformedBounds(box, localMatrix),
        });
      }
      return;
    }

    if (tag === "svg") {
      if (box.w > 0 && box.h > 0) {
        const captured = { z: localZ, order: order++, clip: localClip, matrix: localMatrix };
        pending.push(
          svgToImage(el as unknown as SVGElement, box.w, box.h, scale).then((img) => {
            push({
              kind: "image",
              source: img,
              sw: img.naturalWidth || box.w * scale,
              sh: img.naturalHeight || box.h * scale,
              rect: box,
              fit: "fill",
              ...captured,
              bounds: transformedBounds(box, localMatrix),
            });
          }),
        );
      }
      return;
    }

    const letterSpacing = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) || 0;
    const font = fontShorthand(cs);
    const color = cs.color;

    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const node = child as Text;
        if (!(node.nodeValue || "").trim()) return;
        for (const line of textLines(node, origin)) {
          push({
            kind: "text",
            text: line.text,
            x: line.rect.x,
            // A linha da caixa de texto cobre ascendente + descendente da
            // fonte; a baseline é reconstituída proporcionalmente na pintura.
            baseline: line.rect.y + line.rect.h,
            font,
            color,
            letterSpacing,
            z: localZ,
            order: order++,
            clip: localClip,
            matrix: localMatrix,
            bounds: transformedBounds({ ...line.rect, h: line.rect.h * 1.4 }, localMatrix),
          });
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as HTMLElement, localClip, localMatrix, localZ);
      }
    });
  };

  const pageCs = win.getComputedStyle(page);
  const pageBox = boxOf(page);
  if (!isTransparent(pageCs.backgroundColor)) {
    items.push({
      kind: "fill",
      rect: pageBox,
      color: pageCs.backgroundColor,
      z: -1,
      order: order++,
      clip: null,
      matrix: null,
      bounds: pageBox,
    });
  }
  Array.from(page.children).forEach((child) => walk(child as HTMLElement, pageBox, null, 0));

  await Promise.all(pending);

  // Restaura o DOM (páginas seguintes e novas tentativas dependem disso).
  transformed.forEach((t) => {
    if (t.prev) t.el.style.transform = t.prev;
    else t.el.style.removeProperty("transform");
  });

  items.sort((a, b) => (a.z === b.z ? a.order - b.order : a.z - b.z));
  return { items, width: pageBox.w, height: pageBox.h };
}

/* ------------------------------------------------------------------ *
 * Pintura
 * ------------------------------------------------------------------ */

function drawObjectFit(
  ctx: CanvasRenderingContext2D,
  item: ImageItem,
) {
  const { rect, sw, sh, fit } = item;
  if (fit === "cover" || fit === "contain") {
    const scale = fit === "cover" ? Math.max(rect.w / sw, rect.h / sh) : Math.min(rect.w / sw, rect.h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    ctx.drawImage(item.source, rect.x + (rect.w - dw) / 2, rect.y + (rect.h - dh) / 2, dw, dh);
    return;
  }
  ctx.drawImage(item.source, rect.x, rect.y, rect.w, rect.h);
}

function drawText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.font = item.font;
  ctx.fillStyle = item.color;
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(item.text);
  const asc = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || 0;
  const desc = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || 0;
  const total = asc + desc;
  // `item.baseline` chega como a BASE da caixa de texto medida no DOM.
  const y = total > 0 ? item.baseline - desc : item.baseline;

  if (item.letterSpacing) {
    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if (typeof spaced.letterSpacing === "string") {
      spaced.letterSpacing = `${item.letterSpacing}px`;
      spaced.fillText(item.text, item.x, y);
      spaced.letterSpacing = "0px";
      return;
    }
    let cursor = item.x;
    for (const char of item.text) {
      spaced.fillText(char, cursor, y);
      cursor += spaced.measureText(char).width + item.letterSpacing;
    }
    return;
  }

  ctx.fillText(item.text, item.x, y);
}

function paintBand(
  ctx: CanvasRenderingContext2D,
  items: Item[],
  scale: number,
  top: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width * scale, height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, -top * scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bandTop = top;
  const bandBottom = top + height;

  for (const item of items) {
    if (item.bounds.y > bandBottom || item.bounds.y + item.bounds.h < bandTop) continue;

    ctx.save();
    if (item.clip) {
      ctx.beginPath();
      ctx.rect(item.clip.x, item.clip.y, item.clip.w, item.clip.h);
      ctx.clip();
    }
    if (item.matrix) ctx.transform(...item.matrix);

    if (item.kind === "fill") {
      ctx.fillStyle = item.color;
      ctx.fillRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h);
    } else if (item.kind === "image") {
      drawObjectFit(ctx, item);
    } else {
      drawText(ctx, item);
    }
    ctx.restore();
  }
  ctx.restore();
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") {
      const encoded = canvas.toDataURL("image/jpeg", quality);
      const binary = atob(encoded.slice(encoded.indexOf(",") + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      resolve(bytes);
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao codificar a página."));
          return;
        }
        blob.arrayBuffer().then((b) => resolve(new Uint8Array(b))).catch(() => reject(new Error("Falha ao ler a página.")));
      },
      "image/jpeg",
      quality,
    );
  });
}

/* ------------------------------------------------------------------ *
 * Motor
 * ------------------------------------------------------------------ */

let jsPdfPromise: Promise<typeof import("jspdf").jsPDF> | null = null;

/** Pré-carrega o jsPDF enquanto o usuário ainda preenche o formulário. */
export function preloadJsPdf() {
  if (!jsPdfPromise) jsPdfPromise = import("jspdf").then((m) => m.jsPDF);
  return jsPdfPromise;
}

function bandHeight(width: number, scale: number): number {
  const maxDim = maxCanvasDimension();
  const gb = deviceMemoryGb();
  const budget = gb <= 2 ? 6_000_000 : isWeakDevice() ? 12_000_000 : 24_000_000;
  const byArea = Math.floor(budget / (width * scale));
  const byDim = Math.floor(maxDim / scale);
  return Math.max(64, Math.min(byArea, byDim, 4000));
}

async function renderOnce(
  html: string,
  scale: number,
  bandDivisor: number,
  abortSignal?: AbortSignal | null,
): Promise<string> {
  const jsPDFCtor = await preloadJsPdf();
  const frame = await createHiddenFrame(html);
  try {
    const doc = frame.contentDocument!;
    await waitForAssets(doc);
    await adoptFontFaces(doc);

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page, .sheet"));
    const targets = pages.length ? pages : [doc.body];
    let pdf: import("jspdf").jsPDF | null = null;

    for (const page of targets) {
      if (abortSignal?.aborted) throw new Error("Geração cancelada.");

      const { items, width, height } = await buildItems(page, scale);
      if (width < 1 || height < 1) continue;

      const usableScale = Math.max(1.5, Math.min(scale, maxCanvasDimension() / width));
      const wPt = width * 0.75;
      const hPt = height * 0.75;

      if (!pdf) {
        pdf = new jsPDFCtor({
          orientation: wPt > hPt ? "landscape" : "portrait",
          unit: "pt",
          format: [wPt, hPt],
          compress: true,
        });
      } else {
        pdf.addPage([wPt, hPt], wPt > hPt ? "landscape" : "portrait");
      }

      const band = Math.max(64, Math.floor(bandHeight(width, usableScale) / bandDivisor));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * usableScale);

      let top = 0;
      while (top < height) {
        if (abortSignal?.aborted) throw new Error("Geração cancelada.");
        const sliceH = Math.min(band, height - top);
        canvas.height = Math.round(sliceH * usableScale);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas indisponível neste aparelho.");

        paintBand(ctx, items, usableScale, top, width, sliceH);
        const bytes = await encodeJpeg(canvas, jpegQuality());
        if (bytes.byteLength < 512) throw new Error("Falha ao rasterizar a página.");

        const yPt = top * 0.75;
        const hSlicePt = Math.min(sliceH * 0.75 + 0.05, hPt - yPt);
        pdf.addImage(bytes, "JPEG", 0, yPt, wPt, hSlicePt, undefined, "NONE");

        top += sliceH;
        if (top < height) await new Promise((r) => setTimeout(r, 8));
      }

      canvas.width = 0;
      canvas.height = 0;
    }

    if (!pdf) throw new Error("Documento vazio.");
    return await blobToDataUrl(pdf.output("blob"));
  } finally {
    frame.remove();
  }
}

/**
 * Renderiza o HTML do documento em PDF (data URL) usando canvas + jsPDF.
 * Mantém uma escada de segurança: primeiro divide mais a página, e só em
 * último caso reduz a escala.
 */
export async function renderHtmlToPdfCanvas(
  html: string,
  preview = false,
  abortSignal?: AbortSignal | null,
): Promise<string> {
  const cap = preview ? previewScale() : FINAL_SCALE;
  const attempts: Array<{ scale: number; bandDivisor: number }> = [
    { scale: cap, bandDivisor: 1 },
    { scale: cap, bandDivisor: 2 },
    { scale: cap, bandDivisor: 4 },
    { scale: Math.max(2, cap - 2), bandDivisor: 4 },
    { scale: 2, bandDivisor: 6 },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      if (abortSignal?.aborted) throw new Error("Geração cancelada.");
      return await renderOnce(html, attempt.scale, attempt.bandDivisor, abortSignal);
    } catch (error) {
      lastError = error;
      if (abortSignal?.aborted) break;
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Não foi possível gerar o documento.");
}
