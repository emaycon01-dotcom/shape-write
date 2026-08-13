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

/**
 * O preview agora é exibido direto das faixas JPEG (sem re-rasterização pelo
 * PDF.js), então ele pode usar a mesma densidade do PDF final. Mantemos um
 * piso de 4x mesmo em aparelhos fracos para que o preview seja WYSIWYG.
 */
function previewScale(): number {
  const gb = deviceMemoryGb();
  if (gb <= 2) return 3;
  if (isWeakDevice()) return 4;
  return Math.max(4, FINAL_SCALE);
}

function jpegQuality(): number {
  const gb = deviceMemoryGb();
  if (gb <= 2) return 0.92;
  if (isWeakDevice()) return 0.96;
  return 0.97;
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
type BorderItem = BaseItem & {
  kind: "border";
  rect: Rect;
  widths: [number, number, number, number];
  colors: [string, string, string, string];
  radius: [number, number, number, number];
};
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
  decoration: { underline: boolean; lineThrough: boolean; color: string; thickness: number } | null;
};


type Item = FillItem | BorderItem | ImageItem | TextItem;


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

/**
 * Sombra sólida sem desfoque (`0 0 0 3px #fff`): no layout dos documentos ela
 * é usada como moldura, então vira um retângulo preenchido atrás do elemento.
 */
function parseSolidShadow(value: string): { color: string; dx: number; dy: number; spread: number } | null {
  if (!value || value === "none") return null;
  if (value.includes("inset")) return null;
  const colorMatch = value.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/);
  if (!colorMatch) return null;
  const rest = value.replace(colorMatch[0], " ");
  const nums = (rest.match(/-?\d*\.?\d+px/g) || []).map(parseFloat);
  if (nums.length < 3) return null;
  const [dx, dy, blur, spread = 0] = nums;
  if (blur > 0.5 || spread <= 0) return null;
  if (isTransparent(colorMatch[0])) return null;
  return { color: colorMatch[0], dx, dy, spread };
}

function parseBorderColor(value: string): string {
  if (!value || value === "transparent") return "";
  return value;
}

function parseBorderWidth(value: string): number {
  if (!value || value === "medium" || value === "thick" || value === "thin") return 0;
  const n = parseFloat(value);
  return Number.isNaN(n) || n <= 0 ? 0 : n;
}

/**
 * Lê as bordas CSS de um elemento. Por enquanto suportamos estilo `solid`
 * (ou qualquer estilo não-zero) como linha retangular; cores transparentes são
 * ignoradas. Radius é capturado para futuro arredondamento, mas aqui usamos
 * caixas retangulares — já é suficiente para as grades dos históricos e
 * diplomas.
 */
function parseBorders(cs: CSSStyleDeclaration): {
  widths: [number, number, number, number];
  colors: [string, string, string, string];
  radius: [number, number, number, number];
} | null {
  const wt = parseBorderWidth(cs.borderTopWidth);
  const wr = parseBorderWidth(cs.borderRightWidth);
  const wb = parseBorderWidth(cs.borderBottomWidth);
  const wl = parseBorderWidth(cs.borderLeftWidth);
  if (wt === 0 && wr === 0 && wb === 0 && wl === 0) return null;

  const ct = parseBorderColor(cs.borderTopColor);
  const cr = parseBorderColor(cs.borderRightColor);
  const cb = parseBorderColor(cs.borderBottomColor);
  const cl = parseBorderColor(cs.borderLeftColor);

  const radius = (val: string) => {
    const n = parseFloat(val);
    return Number.isNaN(n) ? 0 : n;
  };

  return {
    widths: [wt, wr, wb, wl],
    colors: [ct, cr, cb, cl],
    radius: [
      radius(cs.borderTopLeftRadius),
      radius(cs.borderTopRightRadius),
      radius(cs.borderBottomRightRadius),
      radius(cs.borderBottomLeftRadius),
    ],
  };
}

/** Aplica `text-transform` ao texto lido do DOM (o nó guarda o valor original). */
function applyTextTransform(text: string, transform: string): string {

  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") return text.replace(/(^|\s)(\S)/g, (_, s, c) => s + c.toUpperCase());
  return text;
}


/* ------------------------------------------------------------------ *
 * Cache de bitmaps (templates baixam/decodificam UMA vez por sessão)
 * ------------------------------------------------------------------ */

const BITMAP_CACHE_MAX = 6;
const bitmapCache = new Map<string, Promise<ImageBitmap>>();

/** Chave curta e estável para data URLs gigantes (não guarda o base64 inteiro). */
function bitmapKey(src: string): string {
  if (src.length < 512) return src;
  let hash = 5381;
  for (let i = 0; i < src.length; i += 97) hash = ((hash * 33) ^ src.charCodeAt(i)) >>> 0;
  return `${src.length}:${src.slice(0, 64)}:${hash}`;
}

function cachedBitmap(img: HTMLImageElement): Promise<ImageBitmap> | null {
  if (typeof createImageBitmap !== "function") return null;
  const src = img.currentSrc || img.src;
  if (!src) return null;
  const key = bitmapKey(src);
  const hit = bitmapCache.get(key);
  if (hit) return hit;

  const created = createImageBitmap(img);
  created.catch(() => bitmapCache.delete(key));
  bitmapCache.set(key, created);
  while (bitmapCache.size > BITMAP_CACHE_MAX) {
    const oldest = bitmapCache.keys().next().value as string | undefined;
    if (!oldest || oldest === key) break;
    const stale = bitmapCache.get(oldest);
    bitmapCache.delete(oldest);
    void stale?.then((b) => b.close?.()).catch(() => undefined);
  }
  return created;
}

/** Libera todos os bitmaps (usado quando uma geração falha por memória). */
export function releaseBitmapCache() {
  bitmapCache.forEach((p) => void p.then((b) => b.close?.()).catch(() => undefined));
  bitmapCache.clear();
}

/* ------------------------------------------------------------------ *
 * Preview direto (sem re-rasterizar o PDF com o PDF.js)
 * ------------------------------------------------------------------ */

export type PreviewBand = { url: string; top: number; height: number };
export type PreviewPage = { width: number; height: number; bands: PreviewBand[] };

let previewPagesKey: string | null = null;
let previewPages: PreviewPage[] = [];

/** Identificador curto: evita reter a Data URL inteira apenas como chave. */
function previewKey(value: string): string {
  let hash = 5381;
  const step = Math.max(1, Math.floor(value.length / 2048));
  for (let index = 0; index < value.length; index += step) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return `${value.length}:${value.slice(0, 48)}:${value.slice(-32)}:${hash}`;
}

function storePreviewPages(key: string, pages: PreviewPage[]) {
  // Mesmo PDF pode ser recriado com uma Data URL idêntica em uma repetição.
  // As novas faixas são outros object URLs; portanto as anteriores precisam
  // ser liberadas independentemente da igualdade da chave.
  const stalePages = previewPages;
  previewPagesKey = previewKey(key);
  previewPages = pages;
  // Não revoga as imagens que o visualizador ainda está exibindo. O novo PDF
  // chega ao React logo depois desta chamada; alguns segundos de sobreposição
  // garantem uma troca atômica também no WebKit sem manter lixo na sessão.
  if (stalePages.length) {
    window.setTimeout(() => {
      stalePages.forEach((page) => page.bands.forEach((band) => URL.revokeObjectURL(band.url)));
    }, 10_000);
  }
}

/** Libera imediatamente as faixas do preview anterior antes da geração final. */
export function releasePreviewPages() {
  previewPages.forEach((page) => page.bands.forEach((band) => URL.revokeObjectURL(band.url)));
  previewPagesKey = null;
  previewPages = [];
}

/** Bitmaps já rasterizados do último preview — evita rodar o PDF.js de novo. */
export function getPreviewPages(key: string): PreviewPage[] | null {
  return previewPagesKey === previewKey(key) && previewPages.length > 0 ? previewPages : null;
}

/** Escala usada na última rasterização (permite reaproveitar o preview). */
let lastRenderScale = 0;
export function getLastRenderScale(): number {
  return lastRenderScale;
}
export const FINAL_RENDER_SCALE = FINAL_SCALE;



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
function textLines(node: Text, origin: { left: number; top: number }, whiteSpace: string): { text: string; rect: Rect }[] {
  const doc = node.ownerDocument;
  const range = doc.createRange();
  range.selectNodeContents(node);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  const raw = node.nodeValue || "";
  if (rects.length === 0) return [];

  // Em `pre`/`pre-wrap` os espaços são significativos (blocos MRZ).
  const preserve = whiteSpace.startsWith("pre");

  if (rects.length === 1) {
    const r = rects[0];
    const text = preserve ? raw.replace(/\n/g, "") : raw.replace(/\s+/g, " ").trim();
    if (!text.trim()) return [];
    return [
      { text, rect: { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height } },
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
          text: preserve ? current.chars.join("").replace(/\n/g, "") : current.chars.join("").trim(),
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
      text: preserve ? current.chars.join("").replace(/\n/g, "") : current.chars.join("").trim(),
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
type BuildItemsResult = {
  items: Item[];
  width: number;
  height: number;
  coordScale?: number;
  visualW?: number;
  visualH?: number;
  offsetX?: number;
  offsetY?: number;
};

/**
 * Alguns templates (diploma, UNIP, Anhanguera) usam um container `.canvas`
 * filho único da página, desenhado em resolução "natural" e depois encolhido
 * com `transform: scale(S)` para caber na página visual. Detectamos esse
 * padrão para poder medir/desenhar no sistema de coordenadas natural e só
 * mapear para o tamanho visual na hora de pintar (mantendo o texto nítido).
 */
function findScaledCanvasRoot(
  page: HTMLElement,
  win: Window,
): { el: HTMLElement; matrix: Matrix } | null {
  const children = Array.from(page.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.tagName === "DIV",
  );
  if (children.length !== 1) return null;
  const el = children[0];
  if (!el.classList.contains("canvas")) return null;
  const cs = win.getComputedStyle(el);
  const m = parseMatrix(cs.transform);
  if (!m) return null;
  const isUniformScale =
    m[1] === 0 && m[2] === 0 && m[0] === m[3] && m[0] > 0 && m[4] === 0 && m[5] === 0;
  if (!isUniformScale || isIdentity(m)) return null;
  return { el, matrix: m };
}

async function buildItems(page: HTMLElement, scale: number): Promise<BuildItemsResult> {
  const win = page.ownerDocument.defaultView!;
  const pageOrigin = page.getBoundingClientRect();

  const scaledCanvas = findScaledCanvasRoot(page, win);
  let coordScale: number | undefined;
  let offsetX: number | undefined;
  let offsetY: number | undefined;
  let visualW: number | undefined;
  let visualH: number | undefined;
  let canvasPrevTransform: string | null = null;
  let canvasRoot: HTMLElement | null = null;
  let naturalBox: Rect = { x: 0, y: 0, w: pageOrigin.width, h: pageOrigin.height };

  if (scaledCanvas) {
    canvasRoot = scaledCanvas.el;
    canvasPrevTransform = canvasRoot.style.transform;
    canvasRoot.style.transform = "none";

    const rect = canvasRoot.getBoundingClientRect();
    naturalBox = {
      x: rect.left - pageOrigin.left,
      y: rect.top - pageOrigin.top,
      w: rect.width,
      h: rect.height,
    };

    const cs = win.getComputedStyle(canvasRoot);
    const [oxRaw, oyRaw] = cs.transformOrigin.split(" ");
    const ox = parseFloat(oxRaw) || 0;
    const oy = parseFloat(oyRaw) || 0;

    coordScale = scaledCanvas.matrix[0];
    offsetX = (naturalBox.x + ox) * (1 - coordScale);
    offsetY = (naturalBox.y + oy) * (1 - coordScale);
    visualW = naturalBox.w * coordScale;
    visualH = naturalBox.h * coordScale;
  }

  // Origem usada para medir todas as caixas: a página, ou o topo/esquerda
  // natural do `.canvas`, quando presente.
  const origin: { left: number; top: number } = canvasRoot
    ? { left: pageOrigin.left + naturalBox.x, top: pageOrigin.top + naturalBox.y }
    : pageOrigin;

  // Os transforms precisam ser desligados ANTES de medir: com eles ligados o
  // navegador devolve a caixa já rotacionada e o texto sairia torto. Guardamos
  // a matriz de cada elemento e reaplicamos na hora de desenhar.
  const transformed: { el: HTMLElement; matrix: Matrix; ox: number; oy: number; prev: string }[] = [];
  page.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el === canvasRoot) return;
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
      // O clip é aplicado ANTES da matriz na hora de pintar, ou seja, vive no
      // espaço externo (página). Quando o elemento (ou um ancestral) está sob
      // um transform, a caixa medida está em coordenadas naturais e precisa ser
      // convertida — sem isso, tudo que fica além da área da página em
      // coordenadas naturais (ex.: QR Code no canto inferior direito de um
      // `.canvas` escalado) era recortado e sumia do PDF.
      localClip = intersect(clip, transformedBounds(box, localMatrix));
    }


    let localZ = z;
    if (cs.position !== "static" && cs.zIndex !== "auto") {
      const parsed = parseInt(cs.zIndex, 10);
      if (!Number.isNaN(parsed)) localZ = parsed;
    }

    const push = (item: Item) => {
      items.push(item);
    };

    // Sombra sólida (spread sem blur) — usada como "moldura" branca ao redor
    // da foto no RG. Vai antes do fundo para ficar realmente atrás.
    const shadow = parseSolidShadow(cs.boxShadow);
    if (shadow && box.w > 0 && box.h > 0) {
      const rect: Rect = {
        x: box.x + shadow.dx - shadow.spread,
        y: box.y + shadow.dy - shadow.spread,
        w: box.w + shadow.spread * 2,
        h: box.h + shadow.spread * 2,
      };
      push({
        kind: "fill",
        rect,
        color: shadow.color,
        z: localZ,
        order: order++,
        clip: clip,
        matrix: localMatrix,
        bounds: transformedBounds(rect, localMatrix),
      });
    }

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

    const borders = parseBorders(cs);
    if (borders && box.w > 0 && box.h > 0) {
      push({
        kind: "border",
        rect: box,
        widths: borders.widths,
        colors: borders.colors,
        radius: borders.radius,
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
        const captured = { z: localZ, order: order++, clip: localClip, matrix: localMatrix };
        const base = {
          kind: "image" as const,
          sw: img.naturalWidth,
          sh: img.naturalHeight,
          rect: box,
          fit: cs.objectFit || "fill",
          ...captured,
          bounds: transformedBounds(box, localMatrix),
        };
        // Template pesado: decodifica UMA vez por sessão (ImageBitmap em cache).
        // Sem isso, cada faixa e cada nova geração redecodificavam o mesmo
        // JPEG de 3300x4660 — o maior gargalo em celulares.
        const bitmap = cachedBitmap(img);
        if (bitmap) {
          pending.push(
            bitmap
              .then((bmp) => push({ ...base, source: bmp }))
              .catch(() => push({ ...base, source: img })),
          );
        } else {
          push({ ...base, source: img });
        }
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
    const decorationLine = cs.textDecorationLine || cs.textDecoration || "";
    const hasUnderline = decorationLine.includes("underline");
    const hasLineThrough = decorationLine.includes("line-through");
    const decoration =
      hasUnderline || hasLineThrough
        ? {
            underline: hasUnderline,
            lineThrough: hasLineThrough,
            color: cs.textDecorationColor || color,
            thickness: parseFloat(cs.textDecorationThickness) || Math.max(1, parseFloat(cs.fontSize) / 16),
          }
        : null;

    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const node = child as Text;
        if (!(node.nodeValue || "").trim()) return;
        for (const line of textLines(node, origin, cs.whiteSpace)) {
          push({
            kind: "text",
            text: applyTextTransform(line.text, cs.textTransform),
            x: line.rect.x,
            // A linha da caixa de texto cobre ascendente + descendente da
            // fonte; a baseline é reconstituída proporcionalmente na pintura.
            baseline: line.rect.y + line.rect.h,
            font,
            color,
            letterSpacing,
            decoration,
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


  if (canvasRoot) {
    // A raiz do desenho agora é o `.canvas`: usamos a caixa natural (0,0 a
    // largura/altura naturais) como clip inicial e sempre adicionamos um
    // fundo branco cobrindo toda a página visual — o `.canvas` pode ser menor
    // que a página (letterboxing) quando a proporção não bate exatamente.
    const naturalPageRect: Rect = {
      x: -(offsetX ?? 0) / (coordScale ?? 1),
      y: -(offsetY ?? 0) / (coordScale ?? 1),
      w: pageOrigin.width / (coordScale ?? 1),
      h: pageOrigin.height / (coordScale ?? 1),
    };
    items.push({
      kind: "fill",
      rect: naturalPageRect,
      color: "#ffffff",
      z: -2,
      order: order++,
      clip: null,
      matrix: null,
      bounds: naturalPageRect,
    });

    const canvasBox: Rect = { x: 0, y: 0, w: naturalBox.w, h: naturalBox.h };
    const canvasCs = win.getComputedStyle(canvasRoot);
    if (!isTransparent(canvasCs.backgroundColor)) {
      items.push({
        kind: "fill",
        rect: canvasBox,
        color: canvasCs.backgroundColor,
        z: -1,
        order: order++,
        clip: null,
        matrix: null,
        bounds: canvasBox,
      });
    }
    Array.from(canvasRoot.children).forEach((child) => walk(child as HTMLElement, canvasBox, null, 0));
  } else {
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
  }

  await Promise.all(pending);

  // Restaura o DOM (páginas seguintes e novas tentativas dependem disso).
  transformed.forEach((t) => {
    if (t.prev) t.el.style.transform = t.prev;
    else t.el.style.removeProperty("transform");
  });
  if (canvasRoot) {
    if (canvasPrevTransform) canvasRoot.style.transform = canvasPrevTransform;
    else canvasRoot.style.removeProperty("transform");
  }

  items.sort((a, b) => (a.z === b.z ? a.order - b.order : a.z - b.z));
  return {
    items,
    width: pageOrigin.width,
    height: pageOrigin.height,
    coordScale,
    visualW,
    visualH,
    offsetX,
    offsetY,
  };
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

function drawBorder(ctx: CanvasRenderingContext2D, item: BorderItem) {
  const { rect, widths, colors } = item;
  const [wt, wr, wb, wl] = widths;
  const [ct, cr, cb, cl] = colors;

  // Desenha cada lado como um retângulo preenchido. Isso cobre a grande
  // maioria dos casos (grades, caixas) sem precisar de path arredondado.
  ctx.save();
  if (wt > 0 && ct) {
    ctx.fillStyle = ct;
    ctx.fillRect(rect.x, rect.y, rect.w, wt);
  }
  if (wb > 0 && cb) {
    ctx.fillStyle = cb;
    ctx.fillRect(rect.x, rect.y + rect.h - wb, rect.w, wb);
  }
  if (wl > 0 && cl) {
    ctx.fillStyle = cl;
    ctx.fillRect(rect.x, rect.y, wl, rect.h);
  }
  if (wr > 0 && cr) {
    ctx.fillStyle = cr;
    ctx.fillRect(rect.x + rect.w - wr, rect.y, wr, rect.h);
  }
  ctx.restore();
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

  if (item.decoration) {
    const metrics = ctx.measureText(item.text);
    const width = metrics.width;
    ctx.fillStyle = item.decoration.color;
    const { underline, lineThrough, thickness } = item.decoration;
    if (underline) {
      const uy = y + (metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || 2) + thickness * 0.5;
      ctx.fillRect(item.x, uy, width, thickness);
    }
    if (lineThrough) {
      const em = parseFloat(ctx.font) || 12;
      const sy = y - em * 0.35;
      ctx.fillRect(item.x, sy, width, thickness);
    }
  }
}

function paintBand(

  ctx: CanvasRenderingContext2D,
  items: Item[],
  scale: number,
  top: number,
  width: number,
  height: number,
  coordScale = 1,
  offsetX = 0,
  offsetY = 0,
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width * scale, height * scale);
  ctx.setTransform(
    scale * coordScale,
    0,
    0,
    scale * coordScale,
    offsetX * scale,
    (offsetY - top) * scale,
  );
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // `top`/`height` chegam em coordenadas visuais (tamanho da página); os itens
  // estão em coordenadas naturais quando há um `.canvas` escalado, então a
  // faixa de corte também precisa ser convertida antes de comparar.
  const bandTop = (top - offsetY) / coordScale;
  const bandBottom = (top + height - offsetY) / coordScale;

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
    } else if (item.kind === "border") {
      drawBorder(ctx, item);
    } else if (item.kind === "image") {
      drawObjectFit(ctx, item);
    } else {
      drawText(ctx, item as TextItem);
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

/**
 * WebKit pode aceitar a alocação do canvas e, mesmo assim, perder o backing
 * store por pressão de memória. Nesse caso nenhuma API lança erro: o JPEG sai
 * quase totalmente preto e acabava sendo publicado no preview e no PDF final.
 *
 * A amostra distribuída evita ler a faixa inteira. Não tratamos branco como
 * falha porque documentos podem ter áreas legitimamente vazias.
 */
function isBlackCanvas(canvas: HTMLCanvasElement): boolean {
  try {
    if (canvas.width < 2 || canvas.height < 2) return false;
    const probe = document.createElement("canvas");
    probe.width = 24;
    probe.height = 24;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    const pixels = ctx.getImageData(0, 0, probe.width, probe.height).data;
    let black = 0;
    let transparent = 0;
    const total = pixels.length / 4;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] < 14 && pixels[index + 1] < 14 && pixels[index + 2] < 14) black += 1;
      if (pixels[index + 3] < 8) transparent += 1;
    }
    probe.width = 0;
    probe.height = 0;
    return black / total > 0.975 || transparent / total > 0.995;
  } catch {
    // Se a leitura do backing store falhar, a faixa não é segura para publicar.
    return true;
  }
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
  collectPreview = false,
): Promise<string> {
  const jsPDFCtor = await preloadJsPdf();
  const frame = await createHiddenFrame(html);
  const collected: PreviewPage[] = [];
  try {
    const doc = frame.contentDocument!;
    await waitForAssets(doc);
    await adoptFontFaces(doc);

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page, .sheet"));
    const targets = pages.length ? pages : [doc.body];
    let pdf: import("jspdf").jsPDF | null = null;

    for (const page of targets) {
      if (abortSignal?.aborted) throw new Error("Geração cancelada.");

      const buildResult = await buildItems(page, scale);
      const { items } = buildResult;
      const width = buildResult.visualW ?? buildResult.width;
      const height = buildResult.visualH ?? buildResult.height;
      const coordScale = buildResult.coordScale ?? 1;
      const offsetX = buildResult.offsetX ?? 0;
      const offsetY = buildResult.offsetY ?? 0;
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
      const pagePreview: PreviewPage = { width, height, bands: [] };

      try {
        let top = 0;
        while (top < height) {
          if (abortSignal?.aborted) throw new Error("Geração cancelada.");
          const sliceH = Math.min(band, height - top);
          canvas.height = Math.round(sliceH * usableScale);
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("Canvas indisponível neste aparelho.");

          paintBand(ctx, items, usableScale, top, width, sliceH, coordScale, offsetX, offsetY);
          if (isBlackCanvas(canvas)) {
            throw new Error("O aparelho descartou a faixa de imagem durante a rasterização.");
          }
          const bytes = await encodeJpeg(canvas, jpegQuality());
          if (bytes.byteLength < 512) throw new Error("Falha ao rasterizar a página.");

          const yPt = top * 0.75;
          const hSlicePt = Math.min(sliceH * 0.75 + 0.05, hPt - yPt);
          pdf.addImage(bytes, "JPEG", 0, yPt, wPt, hSlicePt, undefined, "NONE");

          if (collectPreview) {
            // A mesma faixa já rasterizada vira a imagem do preview — o PDF.js
            // não precisa desenhar tudo de novo.
            // O Blob já captura os bytes; `slice()` criava outra cópia completa
            // de cada faixa justamente no pico de memória do preview.
            const url = URL.createObjectURL(
              new Blob([bytes.buffer as ArrayBuffer], { type: "image/jpeg" }),
            );
            pagePreview.bands.push({ url, top, height: sliceH });
          }

          top += sliceH;
          if (top < height) await new Promise((r) => setTimeout(r, 8));
        }

        if (collectPreview) collected.push(pagePreview);
      } finally {
        // Essencial no Safari: se uma faixa falhar, zerar o backing store antes
        // da próxima tentativa; aguardar apenas o GC mantém dezenas de MB vivos.
        canvas.width = 0;
        canvas.height = 0;
      }
    }

    if (!pdf) throw new Error("Documento vazio.");
    const dataUrl = await blobToDataUrl(pdf.output("blob"));
    if (collectPreview && collected.length) storePreviewPages(dataUrl, collected);
    return dataUrl;
  } catch (error) {
    collected.forEach((p) => p.bands.forEach((b) => URL.revokeObjectURL(b.url)));
    throw error;
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
      // As mesmas faixas que entram no jsPDF também alimentam o visualizador.
      // Isso evita que o PDF final recém-gerado seja decodificado e rasterizado
      // inteiro outra vez pelo PDF.js logo após a geração em 576 DPI.
      const result = await renderOnce(html, attempt.scale, attempt.bandDivisor, abortSignal, true);
      lastRenderScale = attempt.scale;
      return result;

    } catch (error) {
      lastError = error;
      if (abortSignal?.aborted) break;
      // Uma tentativa que falhou por memória deixa bitmaps presos no processo.
      // Liberamos desde a primeira falha, antes de criar o próximo canvas.
      releaseBitmapCache();
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Não foi possível gerar o documento.");
}

