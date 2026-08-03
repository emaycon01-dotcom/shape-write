import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { authenticateRequest } from "../_shared/auth.ts";
import { CNH_FONT_FACE } from "./cnh-font.ts";
import { qrSvg, registerValidationDocument, buildDocumentoId } from "./validacao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";
const PDFCO_API_URL = "https://api.pdf.co/v1/pdf/convert/from/html";

async function generateWithPdfShift(html: string, apiKey: string) {
  const pdfRes = await fetch(PDFSHIFT_API_URL, {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      use_print: true,
      format: "A4",
      // Todos os assets (fonte, template, foto) são base64 inline — não há
      // download externo, então um delay curto já garante a renderização.
      delay: 120,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    }),
  });

  if (!pdfRes.ok) {
    const errText = await pdfRes.text();
    if (pdfRes.status === 402 || /remaining credits/i.test(errText)) {
      throw new Error("PDFSHIFT_NO_CREDITS");
    }
    throw new Error(`PDFShift error [${pdfRes.status}]: ${errText}`);
  }

  return new Uint8Array(await pdfRes.arrayBuffer());
}

async function generateWithPdfCo(html: string, apiKey: string) {
  const pdfRes = await fetch(PDFCO_API_URL, {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      html,
      name: "cnh.pdf",
      async: false,
      margins: "0px 0px 0px 0px",
      paperSize: "A4",
      orientation: "Portrait",
      printBackground: true,
    }),
  });

  const payload = await pdfRes.json().catch(async () => ({
    error: true,
    message: await pdfRes.text().catch(() => "Unknown PDF.co error"),
  }));

  if (!pdfRes.ok || payload?.error || !payload?.url) {
    throw new Error(
      `PDF.co error [${pdfRes.status}]: ${payload?.message || payload?.error || "Failed to create PDF"}`
    );
  }

  const fileRes = await fetch(payload.url, { signal: AbortSignal.timeout(45_000) });
  if (!fileRes.ok) {
    const errText = await fileRes.text();
    throw new Error(`PDF.co file download error [${fileRes.status}]: ${errText}`);
  }

  return new Uint8Array(await fileRes.arrayBuffer());
}

function normalizeMrzText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();
}

function toMrzToken(value: string) {
  return normalizeMrzText(value).replace(/\s+/g, "<");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toMrzDate(value: string) {
  const br = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy.slice(2)}${mm}${dd}`;
  }

  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${yyyy.slice(2)}${mm}${dd}`;
  }

  return "<<<<<<";
}

function mrzCharValue(char: string) {
  if (char === "<") return 0;
  if (/\d/.test(char)) return Number(char);
  return char.charCodeAt(0) - 55;
}

function mrzCheckDigit(value: string) {
  const weights = [7, 3, 1];
  let sum = 0;

  for (let i = 0; i < value.length; i++) {
    sum += mrzCharValue(value[i]) * weights[i % 3];
  }

  return String(sum % 10);
}

const MRZ_SUFFIXES = ["002", "082", "882"];

function buildMrz(d: Record<string, string>) {
  // Linha 1: I<BRA + nº de registro (11) + "<" + código de 3 dígitos + preenchimento até 30
  const registro = toMrzToken(d.registro || d.numero_espelho || "")
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(11, "0")
    .slice(0, 11);

  const digitSum = registro.split("").reduce((acc, c) => acc + (Number(c) || 0), 0);
  const suffix = MRZ_SUFFIXES[digitSum % MRZ_SUFFIXES.length];

  const line1 = `I<BRA${registro}<${suffix}`.padEnd(30, "<").slice(0, 30);

  // Linha 2: nascimento + dv + sexo + validade + dv + BRA + opcional + dv composto
  const birth = toMrzDate(d.data_nascimento || "");
  const expiry = toMrzDate(d.data_validade || "");
  const birthCheck = mrzCheckDigit(birth);
  const expiryCheck = mrzCheckDigit(expiry);

  const gender = normalizeMrzText(d.genero || "");
  const sex = gender.startsWith("F") ? "F" : "M";

  const optional = "<<<<<<<<<<";
  const finalCheck = mrzCheckDigit(
    `${registro}${suffix}${birth}${birthCheck}${expiry}${expiryCheck}${optional}`
  );

  const line2 = `${birth}${birthCheck}${sex}${expiry}${expiryCheck}BRA${optional}${finalCheck}<`
    .padEnd(30, "<")
    .slice(0, 30);

  // Linha 3: PRIMEIRO<<SEGUNDO<TERCEIRO<<<<
  const parts = toMrzToken(d.nome_completo || "NOME SOBRENOME")
    .split("<")
    .filter(Boolean);
  const first = parts.shift() || "NOME";
  const rest = parts.join("<");
  // Todas as linhas com exatamente 30 caracteres para ficarem perfeitamente alinhadas
  const line3 = `${first}<<${rest}`.padEnd(31, "<").slice(0, 31);

  return {
    line1: escapeHtml(line1),
    line2: escapeHtml(line2),
    line3: escapeHtml(line3),
  };
}

function cleanCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function dataUrlToBytes(value: string) {
  const base64 = value.includes(",") ? value.split(",")[1] : value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

const CATEGORY_UNITS = ["ACC", "A", "B", "C", "D", "E"];

function parseActiveCategories(activeCategory: string) {
  let normalized = activeCategory.replace(/[\s;]+/g, "").toUpperCase();
  const set = new Set<string>();
  if (!normalized) return set;
  if (normalized.includes("ACC")) {
    set.add("ACC");
    normalized = normalized.replace(/ACC/g, "");
  }
  for (const c of ["A", "B", "C", "D", "E"]) {
    if (normalized.includes(c)) set.add(c);
  }
  return set;
}

function normalizeCategoria(cat: string): string {
  const active = parseActiveCategories(cat);
  const ordered = CATEGORY_UNITS.filter((c) => active.has(c)).join("");
  const base = ordered || (cat || "").replace(/[\s;]+/g, "").toUpperCase();
  return base;
}

function formatObservacoes(value: string): string {
  const parts = (value || "")
    .split(/[;,]+/)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  return parts.length ? parts.map((v) => `${v};`).join(" ") : "";
}

function getCatDate(cat: string, d: Record<string, string>): string {
  const key = `validade_cat_${cat.toLowerCase()}`;
  return d[key] || d.data_validade || "";
}

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultCnhFields
const DIGITAL_DEFAULT_POSITIONS: Record<string, Pos> = {
  photo: { x: 98, y: 165, fontSize: 8, w: 82, h: 110 },
  signature: { x: 93, y: 276, fontSize: 7, w: 95, h: 32 },
  nome: { x: 102, y: 149, fontSize: 6.5 },
  primeira_hab: { x: 308, y: 149, fontSize: 6.5 },
  nascimento: { x: 191, y: 168, fontSize: 6.5 },
  emissao: { x: 194, y: 187, fontSize: 6.5 },
  validade: { x: 251, y: 187, fontSize: 6.5 },
  cat_big: { x: 338, y: 184, fontSize: 11 },
  validade_cat_acc: { x: 171, y: 341, fontSize: 4.5 },
  validade_cat_a: { x: 171, y: 353, fontSize: 4.5 },
  validade_cat_b: { x: 171, y: 375, fontSize: 4.5 },
  validade_cat_c: { x: 171, y: 397, fontSize: 4.5 },
  validade_cat_d: { x: 275, y: 342, fontSize: 4.5 },
  validade_cat_e: { x: 274, y: 375, fontSize: 4.5 },
  rg: { x: 193, y: 207, fontSize: 6.5 },
  cpf: { x: 192, y: 226, fontSize: 6.5 },
  registro: { x: 258, y: 226, fontSize: 6.5 },
  cat_hab: { x: 320, y: 225, fontSize: 7 },
  nacionalidade: { x: 191, y: 245, fontSize: 6.5 },
  pai: { x: 192, y: 267, fontSize: 6.5 },
  mae: { x: 192, y: 278, fontSize: 6.5 },
  obs: { x: 99, y: 430, fontSize: 5.5 },
  espelho: { x: 283, y: 498, fontSize: 6.5 },
  renach: { x: 284, y: 507, fontSize: 6.5 },
  local: { x: 98, y: 507, fontSize: 6 },
  estado: { x: 201, y: 534, fontSize: 15 },
  mrz: { x: 99, y: 706, fontSize: 9.5 },
  reg_vert_top: { x: 66, y: 302, fontSize: 12, rotate: -90 },
  reg_vert_bot: { x: 64, y: 546, fontSize: 11.5, rotate: -90 },
  qr: { x: 437, y: 118, fontSize: 8, w: 277, h: 277 },
};


function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...DIGITAL_DEFAULT_POSITIONS };
  let parsed: Record<string, Partial<Pos>> | null = null;

  try {
    parsed = typeof overrides === "string" ? JSON.parse(overrides) : (overrides as Record<string, Partial<Pos>>);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === "object") {
    for (const [key, value] of Object.entries(parsed)) {
      const base = result[key];
      if (!base || !value || typeof value.x !== "number" || typeof value.y !== "number") continue;
      result[key] = {
        ...base,
        x: value.x,
        y: value.y,
        fontSize: typeof value.fontSize === "number" ? value.fontSize : base.fontSize,
        ...(typeof value.w === "number" ? { w: value.w } : {}),
        ...(typeof value.h === "number" ? { h: value.h } : {}),
        ...(typeof value.rotate === "number" ? { rotate: value.rotate } : {}),
      };
    }
  }

  // A caixa da assinatura usa exatamente o tamanho definido no editor de
  // alinhamento (o recorte fica por conta do CSS .sig-overlay).
  const sigDefault = DIGITAL_DEFAULT_POSITIONS.signature;
  const sig = result.signature;
  result.signature = {
    ...sig,
    w: sig.w ?? sigDefault.w!,
    h: sig.h ?? sigDefault.h!,
  };

  return result;

}

function buildCatDateOverlays(
  activeCategory: string,
  d: Record<string, string>,
  tipo: string | undefined,
  positions?: Record<string, Pos>
) {
  const active = parseActiveCategories(activeCategory);
  const isDigital = tipo !== "fisica";
  const catPositions: Record<string, { x: number; y: number; fontSize: number }> = isDigital
    ? {
        ACC: positions?.validade_cat_acc ?? DIGITAL_DEFAULT_POSITIONS.validade_cat_acc,
        A: positions?.validade_cat_a ?? DIGITAL_DEFAULT_POSITIONS.validade_cat_a,
        B: positions?.validade_cat_b ?? DIGITAL_DEFAULT_POSITIONS.validade_cat_b,
        C: positions?.validade_cat_c ?? DIGITAL_DEFAULT_POSITIONS.validade_cat_c,
        D: positions?.validade_cat_d ?? DIGITAL_DEFAULT_POSITIONS.validade_cat_d,
        E: positions?.validade_cat_e ?? DIGITAL_DEFAULT_POSITIONS.validade_cat_e,
      }
    : {
        ACC: { x: 169, y: 258, fontSize: 4.5 },
        A: { x: 169, y: 280, fontSize: 4.5 },
        B: { x: 169, y: 302, fontSize: 4.5 },
        C: { x: 169, y: 323, fontSize: 4.5 },
        D: { x: 271, y: 268, fontSize: 4.5 },
        E: { x: 271, y: 291, fontSize: 4.5 },
      };

  let html = "";
  for (const [cat, pos] of Object.entries(catPositions)) {
    if (active.has(cat)) {
      const date = getCatDate(cat, d);
      if (date) {
        html += `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;font-weight:normal;color:#111;">${escapeHtml(date)}</div>`;
      }
    }
  }
  return html;
}

// Caixa fixa do estado (mesma largura usada no editor de alinhamento)
const ESTADO_BOX_W = 170;

function isDefinitiva(value?: string) {
  const v = (value || "").trim().toUpperCase();
  return v === "SIM" || v === "S" || v === "TRUE" || v === "DEFINITIVA";
}

const ESTADO_ACENTOS: Record<string, string> = {
  "SAO PAULO": "SÃO PAULO",
  "PARANA": "PARANÁ",
  "MARANHAO": "MARANHÃO",
  "GOIAS": "GOIÁS",
  "PARA": "PARÁ",
  "PIAUI": "PIAUÍ",
  "AMAPA": "AMAPÁ",
  "CEARA": "CEARÁ",
  "ESPIRITO SANTO": "ESPÍRITO SANTO",
  "RONDONIA": "RONDÔNIA",
  "DISTRITO FEDERAL": "DISTRITO FEDERAL",
};

/** Reaplica acentuação oficial ao nome do estado digitado sem acento. */
export function estadoAcentuado(value: string): string {
  const v = (value || "").trim().toUpperCase();
  const plain = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ESTADO_ACENTOS[plain] || v;
}

/** Auto-ajuste: reduz a fonte para nomes de estado longos, sem sair da caixa. */
function estadoFitStyle(estado: string, baseSize: number) {
  const len = estado.trim().length;
  const maxChars = 9;
  const size = len > maxChars ? Math.max(baseSize * (maxChars / len), baseSize * 0.55) : baseSize;
  return `font-size:${size.toFixed(2)}px;`;
}

/**
 * Auto-ajuste de nomes longos (nome do titular e filiação):
 * nunca corta o texto — reduz a fonte o suficiente para caber na caixa.
 */
function fitTextStyle(value: string, baseSize: number, maxWidth: number, minRatio = 0.4) {
  const len = (value || "").trim().length;
  if (!len) return "";
  const charRatio = 0.52; // largura média por caractere em relação ao font-size
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}



function buildCnhDigitalHtml(d: Record<string, string>, fieldPositions?: unknown, qrValue?: string) {
  const mrz = buildMrz(d);
  const espelhoClean = cleanCode(d.numero_espelho || "");
  const renachClean = cleanCode(d.renach || "");
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const base = (id: string, extra = "") => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;${extra}`;
  };

  const boxStyle = (id: string, extra = "") => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;width:${pos.w}px;height:${pos.h}px;${extra}`;
  };

  const rotStyle = (id: string) => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;transform:rotate(${pos.rotate ?? -90}deg);transform-origin:left top;letter-spacing:0;white-space:nowrap;color:#111;font-weight:normal;`;
  };

  const text = (id: string, value: string, extra = "") =>
    `<div class="overlay" style="${base(id, extra)}">${escapeHtml(value)}</div>`;

  const ellipsis = "max-width:290px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

  return `<!DOCTYPE html>
<html>
<head>
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<meta charset="UTF-8">
<style>
${CNH_FONT_FACE}
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'CNHDigital', Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: 794px;
    margin: 0;
    padding: 0;
  }
  .page {
    width: 794px;
    height: 1123px;
    position: relative;
    background: #fff;
    overflow: hidden;
  }
  .bg-template {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0;
  }
  .bg-template img {
    width: 100%; height: 100%;
    object-fit: fill;
    image-rendering: high-quality;
  }
  .overlay {
    position: absolute;
    z-index: 10;
    font-family: 'CNHDigital', Arial, Helvetica, sans-serif;
    color: #111;
    font-weight: normal;
    line-height: 1;
  }
  .photo-overlay { overflow: hidden; }
  .photo-overlay img { width:100%; height:100%; object-fit:cover; image-rendering: high-quality; }
  .qr-overlay { background:#fff; z-index: 12; overflow: hidden; }
  .qr-overlay svg { width:100%; height:100%; display:block; }
  .mrz-line { display:block; text-align:left; white-space:pre; }
  .sig-overlay { display:block; overflow:hidden !important; clip-path:inset(0); contain:strict; box-sizing:border-box; }
  .sig-overlay img { position:absolute; inset:0; display:block; width:100% !important; height:100% !important; max-width:100% !important; max-height:100% !important; object-fit:contain; object-position:center; image-rendering:high-quality; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">
     ${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}
  </div>
  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr")}">${qrSvg(qrValue, p.qr.w ?? 277)}</div>` : ""}
  <div class="overlay photo-overlay" style="${boxStyle("photo")}">${d.foto ? `<img src="${escapeHtml(d.foto)}" />` : ""}</div>
  <div class="overlay sig-overlay" style="${boxStyle("signature")}">${d.assinatura ? `<img src="${escapeHtml(d.assinatura)}" />` : ""}</div>
  <div class="overlay" style="${rotStyle("reg_vert_top")}">${escapeHtml(d.registro || "")}</div>
  ${text("nome", d.nome_completo || "", "max-width:210px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;")}
  ${text("primeira_hab", d.data_primeira_hab || "")}
  ${text("nascimento", d.data_nascimento || "", "max-width:300px;white-space:nowrap;overflow:hidden;")}
  ${text("emissao", d.data_emissao || "")}
  ${text("validade", d.data_validade || "", "color:#c00;")}
  ${text("cat_big", isDefinitiva(d.cnh_definitiva) ? "D" : "P")}
  ${text("rg", d.rg || "", "max-width:300px;white-space:nowrap;overflow:hidden;")}
  ${text("cpf", d.cpf || "")}
  ${text("registro", d.registro || "", "color:#c00;")}
  ${text("cat_hab", normalizeCategoria(d.categoria || ""), "color:#c00;")}
  ${text("nacionalidade", d.nacionalidade || "")}
  ${text("pai", d.nome_pai || "", ellipsis)}
  ${text("mae", d.nome_mae || "", ellipsis)}
  ${buildCatDateOverlays(d.categoria || "", d, "digital", p)}
  ${text("obs", formatObservacoes(d.observacoes || ""), "max-width:370px;")}
  ${text("espelho", espelhoClean, "white-space:nowrap;")}
  ${text("renach", renachClean, "white-space:nowrap;")}
  ${text("local", d.cidade_estado || "")}
  <div class="overlay" style="${base("estado", `width:${ESTADO_BOX_W}px;transform:translateX(-50%);text-align:center;white-space:nowrap;font-weight:normal;font-family:'CNHDigital',Arial,Helvetica,sans-serif;`)}${estadoFitStyle(estadoAcentuado(d.estado_extenso || ""), p.estado.fontSize)}">${escapeHtml(estadoAcentuado(d.estado_extenso || ""))}</div>
  <div class="overlay" style="${rotStyle("reg_vert_bot")}">${escapeHtml(d.registro || "")}</div>
  <div class="overlay" style="${base("mrz", "width:378px;line-height:1.6;font-family:\'CNHDigital\',monospace;")}">
    <div class="mrz-line">${mrz.line1}</div>
    <div class="mrz-line">${mrz.line2}</div>
    <div class="mrz-line">${mrz.line3}</div>
  </div>
</div>
</body>
</html>`;
}


function getEstadoFontSize(estado: string): number {
  const len = estado.length;
  if (len <= 4) return 18;
  if (len <= 7) return 15;
  if (len <= 12) return 12;
  if (len <= 16) return 10;
  return 8;
}

function buildCnhFisicaHtml(d: Record<string, string>) {
  const mrz = buildMrz(d);
  const espelhoClean = cleanCode(d.numero_espelho || "");
  const renachClean = cleanCode(d.renach || "");
  const templateBg = d.template_bg || "";
  const templateVersoBg = d.template_verso_bg || "";

  return `<!DOCTYPE html>
<html>
<head>
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: 794px;
    margin: 0;
    padding: 0;
  }
  .page {
    width: 794px;
    height: 1123px;
    position: relative;
    background: #fff;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .page:last-child {
    page-break-after: auto;
  }
  .bg-template {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 0;
  }
  .bg-template img {
    width: 100%; height: 100%;
    object-fit: fill;
    image-rendering: high-quality;
  }
  .overlay {
    position: absolute;
    z-index: 10;
    font-family: Arial, Helvetica, sans-serif;
    color: #111;
    font-weight: normal;
  }
  .photo-overlay {
    top: 106px; left: 88px;
    width: 82px; height: 110px;
    overflow: hidden;
  }
  .photo-overlay img { width:100%; height:100%; object-fit:cover; image-rendering: high-quality; }
  .sig-overlay {
    top: 216px; left: 85px;
    width: 95px; height: 32px;
    display:block; overflow:hidden !important; clip-path:inset(0);
    contain:strict; box-sizing:border-box;
  }
  .sig-overlay img { position:absolute; inset:0; display:block; width:100% !important; height:100% !important; max-width:100% !important; max-height:100% !important; object-fit:contain; object-position:center; image-rendering:high-quality; }
  .reg-vert-top {
    top: 243px; left: 60px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 15px;
    letter-spacing: 1.2px;
    white-space: nowrap;
    color: #111;
    font-weight: bold;
  }
  .f-nome         { top: 86px; left: 95px; font-size: 6.5px; max-width: 210px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .f-primeira-hab { top: 86px; left: 300px; font-size: 6.5px; }
  .f-nascimento   { top: 106px; left: 185px; font-size: 6.5px; max-width: 300px; white-space: nowrap; overflow: hidden; }
  .f-emissao      { top: 123px; left: 189px; font-size: 6.5px; }
  .f-validade     { top: 124px; left: 248px; font-size: 6.5px; color: #c00; }
  .f-cat-big      { top: 121px; left: 331px; font-size: 11px; color: #111; }
  .f-rg           { top: 143px; left: 184px; font-size: 6.5px; max-width: 300px; white-space: nowrap; overflow: hidden; }
  .f-cpf          { top: 161px; left: 185px; font-size: 6.5px; }
  .f-registro     { top: 161px; left: 250px; font-size: 6.5px; color: #c00; }
  .f-cat-hab      { top: 162px; left: 312px; font-size: 7px; color: #c00; }
  .f-nacionalidade { top: 180px; left: 184px; font-size: 6.5px; }
  .f-pai          { top: 200px; left: 184px; font-size: 6.5px; max-width: 290px; white-space: nowrap; overflow: hidden; }
  .f-mae          { top: 217px; left: 184px; font-size: 6.5px; max-width: 290px; white-space: nowrap; overflow: hidden; }
  .f-obs          { top: 359px; left: 95px; font-size: 5.5px; max-width: 370px; }
  .f-espelho      { top: 416px; left: 279px; font-size: 6.5px; color: #111; white-space: nowrap; font-family: 'Courier New', Courier, monospace; }
  .f-renach       { top: 428px; left: 281px; font-size: 6.5px; color: #111; white-space: nowrap; font-family: 'Courier New', Courier, monospace; }
  .f-local        { top: 434px; left: 91px; font-size: 6px; }
  .reg-vert-bot {
    top: 468px; left: 66px;
    transform: rotate(-90deg);
    transform-origin: left top;
    font-size: 15px;
    letter-spacing: 1.2px;
    white-space: nowrap;
    color: #111;
    font-weight: bold;
  }
  .f-estado {
    top: 448px; left: 175px;
    display: flex; align-items: center; justify-content: center;
    color: #1a5c2a;
    font-family: 'Times New Roman', 'Georgia', serif;
    font-weight: bold;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-align: center;
  }
  .mrz-overlay {
    top: 624px; left: 126px;
    width: 420px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9.5px;
    color: #111;
    letter-spacing: 1.6px;
    line-height: 1.6;
    white-space: pre-line;
  }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">
     ${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}
  </div>
  <div class="overlay photo-overlay">${d.foto ? `<img src="${escapeHtml(d.foto)}" />` : ""}</div>
  <div class="overlay sig-overlay">${d.assinatura ? `<img src="${escapeHtml(d.assinatura)}" />` : ""}</div>
  <div class="overlay reg-vert-top">${escapeHtml(d.registro || "")}</div>
  <div class="overlay f-nome">${escapeHtml(d.nome_completo || "")}</div>
  <div class="overlay f-primeira-hab">${escapeHtml(d.data_primeira_hab || "")}</div>
  <div class="overlay f-nascimento">${escapeHtml(d.data_nascimento || "")}</div>
  <div class="overlay f-emissao">${escapeHtml(d.data_emissao || "")}</div>
  <div class="overlay f-validade">${escapeHtml(d.data_validade || "")}</div>
  <div class="overlay f-cat-big">${escapeHtml(d.categoria || "")}</div>
  <div class="overlay f-rg">${escapeHtml(d.rg || "")}</div>
  <div class="overlay f-cpf">${escapeHtml(d.cpf || "")}</div>
  <div class="overlay f-registro">${escapeHtml(d.registro || "")}</div>
  <div class="overlay f-cat-hab">${escapeHtml(normalizeCategoria(d.categoria || ""))}</div>
  <div class="overlay f-nacionalidade">${escapeHtml(d.nacionalidade || "")}</div>
  <div class="overlay f-pai">${escapeHtml(d.nome_pai || "")}</div>
  <div class="overlay f-mae">${escapeHtml(d.nome_mae || "")}</div>
  ${buildCatDateOverlays(d.categoria || "", d, "fisica")}
  <div class="overlay f-obs">${escapeHtml(d.observacoes || "")}</div>
  <div class="overlay f-espelho">${escapeHtml(espelhoClean)}</div>
  <div class="overlay f-renach">${escapeHtml(renachClean)}</div>
  <div class="overlay f-local">${escapeHtml(d.cidade_estado || "")}</div>
  <div class="overlay reg-vert-bot">${escapeHtml(d.registro || "")}</div>
  <div class="overlay f-estado" style="font-size:${getEstadoFontSize(d.estado_extenso || "")}px;">${escapeHtml(d.estado_extenso || "")}</div>
</div>
<div class="page">
  <div class="bg-template">
    ${templateVersoBg ? `<img src="${escapeHtml(templateVersoBg)}" />` : ""}
  </div>
  <div class="overlay" style="top:422px;left:447px;width:460px;font-family:'Courier New',Courier,monospace;font-size:15px;color:#111;letter-spacing:1.6px;line-height:1.6;white-space:pre-line;">${mrz.line1}<br>${mrz.line2}<br>${mrz.line3}</div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate
  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");
    const PDFCO_API_KEY = Deno.env.get("PDFCO_API_KEY");

    const body = await req.json();

    const data: Record<string, string> = {
      nome_completo: body.nome_completo || "",
      cpf: body.cpf || "",
      rg: body.rg || "",
      data_nascimento: body.data_nascimento || "",
      genero: body.genero || "",
      nacionalidade: body.nacionalidade || "",
      registro: body.registro || "",
      categoria: body.categoria || "",
      data_primeira_hab: body.data_primeira_habilitacao || "",
      data_emissao: body.data_emissao || "",
      data_validade: body.data_validade || "",
      validade_cat_acc: body.validade_cat_acc || "",
      validade_cat_a: body.validade_cat_a || "",
      validade_cat_b: body.validade_cat_b || "",
      validade_cat_c: body.validade_cat_c || "",
      validade_cat_d: body.validade_cat_d || "",
      validade_cat_e: body.validade_cat_e || "",
      renach: body.renach || "",
      codigo_seguranca: body.codigo_seguranca || "",
      numero_espelho: body.numero_espelho || "",
      cidade_estado: body.cidade_estado || "",
      estado_extenso: body.estado_extenso || "",
      cnh_definitiva: body.cnh_definitiva || "",
      nome_pai: body.nome_pai || "",
      nome_mae: body.nome_mae || "",
      observacoes: body.observacoes || "",
      template_bg: body.template_base64 || "",
      template_verso_bg: body.template_verso_base64 || "",
    };

    if (body.foto_base64) {
      data.foto = body.foto_base64.startsWith("data:")
        ? body.foto_base64
        : `data:image/png;base64,${body.foto_base64}`;
    }
    if (body.assinatura_base64) {
      data.assinatura = body.assinatura_base64.startsWith("data:")
        ? body.assinatura_base64
        : `data:image/png;base64,${body.assinatura_base64}`;
    }

    const isFisica = body.tipo === "fisica";

    // Modo preview: NÃO cadastra no site de validação (QR só funciona no PDF final)
    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? {
          documentoId: buildDocumentoId(data),
          qrCodeUrl: "PREVIEW-NAO-VALIDO",
          registered: false,
        }
      : await registerValidationDocument(data);
    console.log(
      `Validação: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}${(validacao as { error?: string }).error ? ` error=${(validacao as { error?: string }).error}` : ""}`,
    );


    const html = isFisica
      ? buildCnhFisicaHtml(data)
      : buildCnhDigitalHtml(data, body.field_positions, validacao.qrCodeUrl);

    // Renderizacao no proprio navegador (sem servico externo de PDF).
    if ((body as any).render === "html") {
      return new Response(
        JSON.stringify({
          success: true,
          render: "browser",
          html,
          documento_id: validacao.documentoId,
          qr_code_url: validacao.qrCodeUrl,
          validacao_registrada: validacao.registered,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let pdfBuffer: Uint8Array | null = null;

    if (PDFSHIFT_API_KEY) {
      try {
        console.log("Sending HTML to PDFShift...");
        pdfBuffer = await generateWithPdfShift(html, PDFSHIFT_API_KEY);
      } catch (error) {
        console.warn("PDFShift failed, attempting PDF.co fallback...", error);
        if (!PDFCO_API_KEY) throw error;
      }
    }

    if (!pdfBuffer) {
      if (!PDFCO_API_KEY) {
        throw new Error("PDF generation failed and PDF.co fallback is not configured");
      }

      console.log("Sending HTML to PDF.co...");
      pdfBuffer = await generateWithPdfCo(html, PDFCO_API_KEY);
    }

    if (body.tipo === "fisica" && body.template_pdf_base64) {
      const generatedPdf = await PDFDocument.load(pdfBuffer);
      const mergedPdf = await PDFDocument.create();

      // Page 1 (front): from generated PDF with overlays
      const frontPages = await mergedPdf.copyPages(generatedPdf, [0]);
      frontPages.forEach((page) => mergedPdf.addPage(page));

      // Page 2 (verso/QR code): from generated PDF with MRZ overlay
      if (generatedPdf.getPageCount() > 1) {
        const versoPages = await mergedPdf.copyPages(generatedPdf, [1]);
        versoPages.forEach((page) => mergedPdf.addPage(page));
      }

      pdfBuffer = await mergedPdf.save();
    }

    const pdfBase64 = bytesToBase64(pdfBuffer);

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: `data:application/pdf;base64,${pdfBase64}`,
        documento_id: validacao.documentoId,
        qr_code_url: validacao.qrCodeUrl,
        validacao_registrada: validacao.registered,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error generating PDF:", error);
    let msg = error instanceof Error ? error.message : "Unknown error";
    if (/PDFSHIFT_NO_CREDITS|remaining credits/i.test(msg)) {
      msg = "O servico de geracao de PDF esta sem creditos. Avise o administrador para recarregar.";
    } else if (/TimeoutError|timed out|aborted/i.test(msg)) {
      msg = "A geracao demorou demais e foi cancelada. Tente novamente em instantes.";
    }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
