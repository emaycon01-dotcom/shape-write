/**
 * Motor de PDF VETORIAL (pdf-lib) — substitui a rasterização por faixas.
 *
 * O HTML montado pelas Edge Functions continua exatamente o mesmo (mesmos
 * templates, mesmas fontes e MESMAS COORDENADAS). A diferença é que aqui o
 * documento não é fotografado em canvas gigantes: o layout já calculado pelo
 * navegador é LIDO (posição real de cada linha, cada caractere, cada imagem)
 * e redesenhado no PDF como texto vetorial + imagens originais.
 *
 * Consequências práticas:
 *  - sem canvas grande  → sem OOM, sem tela preta/branca, sem faixas tortas;
 *  - texto vetorial     → nitidez infinita (não depende mais de DPI);
 *  - alinhamento        → vem do próprio layout do navegador (idêntico ao preview);
 *  - fontes             → os mesmos TTF/OTF das @font-face são embutidos no PDF.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  adoptFontFaces,
  blobToDataUrl,
  createHiddenFrame,
  waitForAssets,
} from "@/lib/browser-pdf";

/** 1px CSS (96dpi) = 0.75pt — mantém o tamanho físico exato do papel. */
const PT = 0.75;

/* ----------------------------------------------------------------- cores */

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(value: string): Rgba | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255, a: parts.length > 3 ? parts[3] : 1 };
}

/* ----------------------------------------------------------------- fontes */

interface FaceSource {
  family: string;
  weight: number;
  italic: boolean;
  bytes: Uint8Array;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function normalizeFamily(name: string): string {
  return name.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
}

function parseWeight(value: string): number {
  if (/bold/i.test(value)) return 700;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 400;
}

/** Lê as @font-face (base64) declaradas no documento e guarda os bytes. */
function collectFaces(doc: Document): FaceSource[] {
  const faces: FaceSource[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRule[] = [];
    try {
      rules = Array.from(sheet.cssRules || []);
    } catch {
      continue;
    }
    for (const rule of rules) {
      const css = rule.cssText || "";
      if (!css.trim().startsWith("@font-face")) continue;
      const style = (rule as CSSFontFaceRule).style;
      const family = normalizeFamily(style.getPropertyValue("font-family"));
      const src = style.getPropertyValue("src");
      if (!family || !src) continue;

      // Só TTF/OTF/WOFF podem ser embutidos pelo fontkit. WOFF2 é ignorado
      // (cai na fonte padrão) — por isso os módulos usam TTF base64.
      const match = src.match(/url\(\s*["']?data:[^;,]*;base64,([^)"']+)["']?\s*\)/);
      if (!match) continue;
      if (/format\(\s*["']?woff2/i.test(src)) continue;

      try {
        faces.push({
          family,
          weight: parseWeight(style.getPropertyValue("font-weight") || "400"),
          italic: /italic|oblique/i.test(style.getPropertyValue("font-style") || ""),
          bytes: base64ToBytes(match[1]),
        });
      } catch {
        /* fonte inválida — usa a padrão */
      }
    }
  }
  return faces;
}

class FontRegistry {
  private cache = new Map<string, PDFFont>();
  private standard = new Map<string, PDFFont>();

  constructor(private pdf: PDFDocument, private faces: FaceSource[]) {}

  private async standardFont(kind: StandardFonts): Promise<PDFFont> {
    const hit = this.standard.get(kind);
    if (hit) return hit;
    const font = await this.pdf.embedFont(kind);
    this.standard.set(kind, font);
    return font;
  }

  private pickFace(family: string, weight: number, italic: boolean): FaceSource | null {
    const candidates = this.faces.filter((f) => f.family === family);
    if (candidates.length === 0) return null;
    const score = (f: FaceSource) =>
      (f.italic === italic ? 0 : 4) + Math.abs(f.weight - weight) / 100;
    return candidates.slice().sort((a, b) => score(a) - score(b))[0];
  }

  /** Resolve a família da CSS para uma fonte real do PDF. */
  async resolve(fontFamilyCss: string, weight: number, italic: boolean): Promise<PDFFont> {
    const families = fontFamilyCss.split(",").map(normalizeFamily).filter(Boolean);

    for (const family of families) {
      const face = this.pickFace(family, weight, italic);
      if (!face) continue;
      const key = `${family}|${face.weight}|${face.italic}`;
      const hit = this.cache.get(key);
      if (hit) return hit;
      try {
        const font = await this.pdf.embedFont(face.bytes, { subset: false });
        this.cache.set(key, font);
        return font;
      } catch {
        /* fonte não embutível — tenta a próxima da pilha */
      }
    }

    const generic = families[families.length - 1] || "sans-serif";
    const bold = weight >= 600;
    if (/mono|courier/.test(generic)) {
      return this.standardFont(
        bold && italic
          ? StandardFonts.CourierBoldOblique
          : bold
            ? StandardFonts.CourierBold
            : italic
              ? StandardFonts.CourierOblique
              : StandardFonts.Courier,
      );
    }
    if (/serif|times|georgia|cambria|garamond/.test(generic) && !/sans/.test(generic)) {
      return this.standardFont(
        bold && italic
          ? StandardFonts.TimesRomanBoldItalic
          : bold
            ? StandardFonts.TimesRomanBold
            : italic
              ? StandardFonts.TimesRomanItalic
              : StandardFonts.TimesRoman,
      );
    }
    return this.standardFont(
      bold && italic
        ? StandardFonts.HelveticaBoldOblique
        : bold
          ? StandardFonts.HelveticaBold
          : italic
            ? StandardFonts.HelveticaOblique
            : StandardFonts.Helvetica,
    );
  }
}

/* -------------------------------------------------------------- métricas */

/**
 * Ascendente/descendente reais da fonte, medidos pelo próprio navegador — é
 * assim que a linha de base fica exatamente onde está no preview HTML.
 */
const metricsCache = new Map<string, { ascent: number; descent: number }>();
let measureCtx: CanvasRenderingContext2D | null = null;

function fontMetrics(fontShorthand: string, fontSize: number) {
  const cached = metricsCache.get(fontShorthand);
  if (cached) return cached;

  let result = { ascent: fontSize * 0.8, descent: fontSize * 0.2 };
  try {
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) {
      measureCtx.font = fontShorthand;
      const m = measureCtx.measureText("HxÁgjpÇ");
      const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
      const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
      if (Number.isFinite(ascent) && Number.isFinite(descent) && ascent > 0) {
        result = { ascent, descent };
      }
    }
  } catch {
    /* usa a estimativa */
  }
  metricsCache.set(fontShorthand, result);
  return result;
}

/* --------------------------------------------------------------- imagens */

function bytesFromDataUrl(url: string): Uint8Array | null {
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  if (!/;base64/i.test(url.slice(0, comma))) return null;
  try {
    return base64ToBytes(url.slice(comma + 1));
  } catch {
    return null;
  }
}

function isPng(bytes: Uint8Array) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}
function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** Converte formatos que o pdf-lib não aceita (WebP, SVG…) em PNG. */
async function rasterize(img: HTMLImageElement): Promise<Uint8Array | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, img.naturalWidth || img.width);
    canvas.height = Math.max(1, img.naturalHeight || img.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function imageBytes(img: HTMLImageElement): Promise<Uint8Array | null> {
  const src = img.currentSrc || img.src;
  if (!src) return null;
  if (src.startsWith("data:")) {
    const bytes = bytesFromDataUrl(src);
    if (bytes && (isPng(bytes) || isJpeg(bytes))) return bytes;
    return rasterize(img);
  }
  try {
    const res = await fetch(src);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (isPng(bytes) || isJpeg(bytes)) return bytes;
  } catch {
    /* cross-origin ou blob revogado */
  }
  return rasterize(img);
}

/* ------------------------------------------------------------- desenho */

interface Ctx {
  pdf: PDFDocument;
  page: PDFPage;
  fonts: FontRegistry;
  win: Window;
  /** canto superior esquerdo da página no viewport do iframe */
  originX: number;
  originY: number;
  /** altura da página em px CSS (para inverter o eixo Y) */
  pageHeight: number;
  imageCache: Map<string, unknown>;
}

const toPt = (px: number) => px * PT;
const yPt = (ctx: Ctx, cssTop: number) => toPt(ctx.pageHeight - (cssTop - ctx.originY));
const xPt = (ctx: Ctx, cssLeft: number) => toPt(cssLeft - ctx.originX);

function drawBackground(ctx: Ctx, el: HTMLElement, cs: CSSStyleDeclaration, opacity: number) {
  const color = parseColor(cs.backgroundColor);
  if (!color || color.a <= 0.01) return;
  const rect = el.getBoundingClientRect();
  if (rect.width < 0.5 || rect.height < 0.5) return;
  ctx.page.drawRectangle({
    x: xPt(ctx, rect.left),
    y: yPt(ctx, rect.bottom),
    width: toPt(rect.width),
    height: toPt(rect.height),
    color: rgb(color.r, color.g, color.b),
    opacity: color.a * opacity,
  });
}

async function drawImage(ctx: Ctx, img: HTMLImageElement, opacity: number) {
  const rect = img.getBoundingClientRect();
  if (rect.width < 0.5 || rect.height < 0.5) return;

  const key = img.currentSrc || img.src;
  let embedded = ctx.imageCache.get(key);
  if (!embedded) {
    const bytes = await imageBytes(img);
    if (!bytes) return;
    embedded = isPng(bytes) ? await ctx.pdf.embedPng(bytes) : await ctx.pdf.embedJpg(bytes);
    ctx.imageCache.set(key, embedded);
  }

  ctx.page.drawImage(embedded as Parameters<PDFPage["drawImage"]>[0], {
    x: xPt(ctx, rect.left),
    y: yPt(ctx, rect.bottom),
    width: toPt(rect.width),
    height: toPt(rect.height),
    opacity,
  });
}

/** QR Codes e afins: SVG feito de <rect> vira vetor puro no PDF. */
function drawSvg(ctx: Ctx, svg: SVGSVGElement, opacity: number): boolean {
  const host = svg.getBoundingClientRect();
  if (host.width < 0.5 || host.height < 0.5) return true;

  const viewBox = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const vbW = viewBox.length === 4 && viewBox[2] > 0 ? viewBox[2] : host.width;
  const vbH = viewBox.length === 4 && viewBox[3] > 0 ? viewBox[3] : host.height;
  const vbX = viewBox.length === 4 ? viewBox[0] : 0;
  const vbY = viewBox.length === 4 ? viewBox[1] : 0;
  const sx = host.width / vbW;
  const sy = host.height / vbH;

  const shapes = Array.from(svg.querySelectorAll("*"));
  if (shapes.some((n) => n.tagName.toLowerCase() !== "rect" && n.tagName.toLowerCase() !== "g")) {
    return false; // formato não suportado → rasteriza
  }

  for (const node of shapes) {
    if (node.tagName.toLowerCase() !== "rect") continue;
    const el = node as SVGRectElement;
    const x = parseFloat(el.getAttribute("x") || "0");
    const y = parseFloat(el.getAttribute("y") || "0");
    const w = parseFloat(el.getAttribute("width") || "0");
    const h = parseFloat(el.getAttribute("height") || "0");
    if (w <= 0 || h <= 0) continue;

    const fillAttr =
      el.getAttribute("fill") ||
      (el.parentElement as Element | null)?.getAttribute("fill") ||
      "#000";
    const fill = fillAttr.startsWith("#")
      ? hexToRgba(fillAttr)
      : parseColor(fillAttr) || { r: 0, g: 0, b: 0, a: 1 };
    if (!fill || fill.a <= 0.01) continue;

    const left = host.left + (x - vbX) * sx;
    const top = host.top + (y - vbY) * sy;
    // +0.3pt cobre o arredondamento entre módulos vizinhos do QR.
    ctx.page.drawRectangle({
      x: xPt(ctx, left),
      y: yPt(ctx, top + h * sy) - 0.15,
      width: toPt(w * sx) + 0.3,
      height: toPt(h * sy) + 0.3,
      color: rgb(fill.r, fill.g, fill.b),
      opacity: fill.a * opacity,
    });
  }
  return true;
}

function hexToRgba(hex: string): Rgba {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0, a: 1 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
}

async function rasterizeSvg(ctx: Ctx, svg: SVGSVGElement, opacity: number) {
  const rect = svg.getBoundingClientRect();
  if (rect.width < 0.5 || rect.height < 0.5) return;
  const markup = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`;
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((done) => {
    img.onload = () => done();
    img.onerror = () => done();
    img.src = url;
  });
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const c2d = canvas.getContext("2d");
  if (!c2d) return;
  c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) return;
  const png = await ctx.pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
  ctx.page.drawImage(png, {
    x: xPt(ctx, rect.left),
    y: yPt(ctx, rect.bottom),
    width: toPt(rect.width),
    height: toPt(rect.height),
    opacity,
  });
}

/** Escala real aplicada pelos transforms dos ancestrais (ex.: scale(0.87)). */
function ancestorScale(el: Element): number {
  let node: Element | null = el;
  while (node) {
    const h = (node as HTMLElement).offsetWidth;
    if (h > 0) {
      const w = node.getBoundingClientRect().width;
      if (w > 0) {
        const s = w / h;
        return Number.isFinite(s) && s > 0.05 && s < 20 ? s : 1;
      }
    }
    node = node.parentElement;
  }
  return 1;
}

type LineRun = { text: string; rect: DOMRect };

/** Agrupa os caracteres do nó em linhas visuais, usando os rects do navegador. */
function collectLines(node: Text): LineRun[] {
  const text = node.nodeValue || "";
  const range = node.ownerDocument!.createRange();
  const runs: LineRun[] = [];
  let current: { chars: string[]; rects: DOMRect[] } | null = null;

  for (let i = 0; i < text.length; i += 1) {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const rects = range.getClientRects();
    const r = rects.length ? (rects[0] as DOMRect) : null;
    if (!r || r.height <= 0) {
      if (current && !text[i].trim()) current.chars.push(text[i]);
      continue;
    }
    const sameLine = current && Math.abs(current.rects[0].top - r.top) < r.height * 0.5;
    if (!sameLine) {
      if (current) runs.push(finishRun(current));
      current = { chars: [], rects: [] };
    }
    current!.chars.push(text[i]);
    current!.rects.push(r);
  }
  if (current) runs.push(finishRun(current));
  range.detach?.();
  return runs.filter((run) => run.text.length > 0 && run.rect.width > 0);
}

function finishRun(acc: { chars: string[]; rects: DOMRect[] }): LineRun {
  // remove espaços das pontas sem perder o alinhamento medido
  let start = 0;
  let end = acc.chars.length - 1;
  while (start <= end && !acc.chars[start].trim()) start += 1;
  while (end >= start && !acc.chars[end].trim()) end -= 1;
  const visible = acc.rects.filter((_, i) => i >= start - (acc.chars.length - acc.rects.length) && true);
  const rects = acc.rects;
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  void visible;
  const text = acc.chars.slice(start, end + 1).join("");
  // recalcula extremos apenas com os caracteres visíveis quando possível
  const visRects = rects.slice(
    Math.max(0, start - Math.max(0, acc.chars.length - rects.length)),
    rects.length,
  );
  const l = visRects.length ? Math.min(...visRects.map((r) => r.left)) : left;
  return {
    text,
    rect: new DOMRect(l, top, right - l, bottom - top),
  };
}

/**
 * Texto: cada LINHA é desenhada como texto real, na posição exata em que o
 * navegador a colocou. O tamanho vem da fonte CSS multiplicada pela escala dos
 * transforms; qualquer diferença residual de largura é corrigida com Tz, o que
 * mantém o texto compacto (sem os "buracos" do desenho caractere a caractere)
 * e com a mesma extensão do preview.
 */
async function drawTextNode(ctx: Ctx, node: Text, opacity: number) {
  const text = node.nodeValue || "";
  if (!/\S/.test(text)) return;
  const parent = node.parentElement;
  if (!parent) return;

  const cs = ctx.win.getComputedStyle(parent);
  if (cs.visibility === "hidden" || cs.display === "none") return;

  const color = parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
  if (color.a <= 0.01) return;

  const cssFontSize = parseFloat(cs.fontSize) || 12;
  const weight = parseWeight(cs.fontWeight);
  const italic = /italic|oblique/.test(cs.fontStyle);
  const font = await ctx.fonts.resolve(cs.fontFamily, weight, italic);
  const { ascent, descent } = fontMetrics(
    `${italic ? "italic " : ""}${weight} ${cssFontSize}px ${cs.fontFamily}`,
    cssFontSize,
  );

  const scale = ancestorScale(parent);
  const sizeCss = cssFontSize * scale;
  const sizePt = toPt(sizeCss);
  const lineBox = (ascent + descent) * scale;

  for (const run of collectLines(node)) {
    const r = run.rect;
    const baseline = r.top + (r.height - lineBox) / 2 + ascent * scale;
    let natural = 0;
    try {
      natural = font.widthOfTextAtSize(run.text, sizePt);
    } catch {
      natural = 0;
    }
    const target = toPt(r.width);
    const squeeze =
      natural > 0 && target > 0 ? Math.min(115, Math.max(85, (target / natural) * 100)) : 100;

    try {
      if (Math.abs(squeeze - 100) > 0.3) ctx.page.pushOperators(setCharacterSqueeze(squeeze));
      ctx.page.drawText(run.text, {
        x: xPt(ctx, r.left),
        y: yPt(ctx, baseline),
        size: sizePt,
        font,
        color: rgb(color.r, color.g, color.b),
        opacity: color.a * opacity,
      });
      if (Math.abs(squeeze - 100) > 0.3) ctx.page.pushOperators(setCharacterSqueeze(100));
    } catch {
      /* caractere fora da fonte — ignora em vez de quebrar o PDF */
    }
  }
}


/** Percorre a página na ordem do DOM (respeita o empilhamento natural). */
async function walk(ctx: Ctx, node: Node, opacity: number) {
  if (node.nodeType === Node.TEXT_NODE) {
    await drawTextNode(ctx, node as Text, opacity);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style" || tag === "noscript") return;

  if (tag === "svg") {
    if (!drawSvg(ctx, el as unknown as SVGSVGElement, opacity)) {
      await rasterizeSvg(ctx, el as unknown as SVGSVGElement, opacity);
    }
    return;
  }

  const cs = ctx.win.getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  const nextOpacity = opacity * (parseFloat(cs.opacity) || 0);
  if (nextOpacity <= 0.01) return;

  drawBackground(ctx, el, cs, nextOpacity);

  if (tag === "img") {
    await drawImage(ctx, el as HTMLImageElement, nextOpacity);
    return;
  }

  for (const child of Array.from(el.childNodes)) {
    await walk(ctx, child, nextOpacity);
  }
}

/* ----------------------------------------------------------------- API */

/**
 * Converte o HTML do documento (com uma ou mais `.page`) num PDF vetorial.
 * Retorna uma Data URL (`data:application/pdf;base64,...`), igual ao motor
 * anterior — o restante do app não muda.
 */
export async function renderHtmlToVectorPdf(html: string): Promise<string> {
  const frame = await createHiddenFrame(html);
  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error("Não foi possível montar o documento.");

    await waitForAssets(doc);
    await adoptFontFaces(doc);

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);

    const faces = collectFaces(doc);
    const fonts = new FontRegistry(pdf, faces);
    const imageCache = new Map<string, unknown>();

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page"));
    const targets = pages.length > 0 ? pages : [doc.body];

    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      const width = rect.width || target.offsetWidth || 794;
      const height = rect.height || target.offsetHeight || 1123;

      const page = pdf.addPage([toPt(width), toPt(height)]);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: toPt(width),
        height: toPt(height),
        color: rgb(1, 1, 1),
      });

      const ctx: Ctx = {
        pdf,
        page,
        fonts,
        win,
        originX: rect.left,
        originY: rect.top,
        pageHeight: height,
        imageCache,
      };

      for (const child of Array.from(target.childNodes)) {
        await walk(ctx, child, 1);
      }
    }

    const bytes = await pdf.save({ useObjectStreams: false });
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
    return await blobToDataUrl(blob);
  } finally {
    frame.remove();
  }
}
