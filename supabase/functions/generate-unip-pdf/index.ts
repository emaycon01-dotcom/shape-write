import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { qrSvg, buildCodigoValidacao, buildValidationUrl, UNIP_VALIDACAO_URL } from "./validacao.ts";
import { UNIP_FONT_FACES } from "./unip-fonts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

/** Escapa o texto preservando marcações <b>…</b> intencionais. */
function richText(value: string) {
  return escapeHtml(value)
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/\n/g, "<br/>");
}

/* ------------------------------------------------------------- geometria */

// Espaço de coordenadas do editor: 1288 x 911 por página (A4 paisagem).
// A página 2 (verso) usa y a partir de 911 — o gerador subtrai o offset.
export const PAGE_W = 1288;
export const PAGE_H = 911;
const SHEET_W = 1123;
const SHEET_H = 794;
const SCALE = SHEET_W / PAGE_W; // 0.871894
const OFFSET_TOP = (SHEET_H - PAGE_H * SCALE) / 2;

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number };

export const UNIP_DEFAULT_POSITIONS: Record<string, Pos> = {
  // ---------------------------- página 1 (frente) ----------------------------
  inst_titulo: { x: 644, y: 168, fontSize: 62 },
  corpo: { x: 644, y: 279, fontSize: 17 },
  titulo_conferido: { x: 644, y: 374, fontSize: 25 },
  aluno: { x: 644, y: 426, fontSize: 32 },
  dados_pessoais: { x: 644, y: 493, fontSize: 17 },
  outorga: { x: 644, y: 560, fontSize: 17 },
  cidade_data: { x: 644, y: 633, fontSize: 17 },
  reitor_nome: { x: 644, y: 746, fontSize: 15 },
  reitor_cargo: { x: 644, y: 768, fontSize: 15 },
  val_bloco: { x: 915, y: 761, fontSize: 10 },
  // ---------------------------- página 2 (verso) -----------------------------
  p2_ra: { x: 757, y: 984, fontSize: 12.5 },
  p2_lote: { x: 1008, y: 984, fontSize: 12.5 },
  p2_esq_mantenedora: { x: 368, y: 1017, fontSize: 12.5 },
  p2_esq_ies: { x: 368, y: 1093, fontSize: 12.5 },
  p2_esq_recred: { x: 368, y: 1144, fontSize: 12.5 },
  p2_esq_curso: { x: 368, y: 1223, fontSize: 12.5 },
  p2_esq_emec: { x: 368, y: 1259, fontSize: 12.5 },
  p2_esq_reconhecimento: { x: 368, y: 1309, fontSize: 12.5 },
  p2_dir_mantenedora: { x: 987, y: 1017, fontSize: 12.5 },
  p2_dir_ies: { x: 987, y: 1060, fontSize: 14.5 },
  p2_dir_recred: { x: 987, y: 1093, fontSize: 12.5 },
  p2_dir_secretaria: { x: 987, y: 1175, fontSize: 12.5 },
  p2_dir_registro: { x: 757, y: 1244, fontSize: 12.5 },
  p2_dir_processo: { x: 757, y: 1352, fontSize: 12.5 },
  p2_dir_cidade_data: { x: 882, y: 1388, fontSize: 12.5 },
  p2_dir_assinatura: { x: 757, y: 1506, fontSize: 12 },
  qr: { x: 1063, y: 1596, fontSize: 8, w: 139, h: 139 },
};

interface StyleDef {
  center?: boolean;
  width?: number;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  /** família: gothic (frente) ou serif (verso) */
  serif?: boolean;
}

const STYLES: Record<string, StyleDef> = {
  inst_titulo: { center: true, width: 1100 },
  corpo: { center: true, width: 1100, lineHeight: 25.2 },
  titulo_conferido: { center: true, width: 1100, lineHeight: 30 },
  aluno: { center: true, width: 1100, lineHeight: 40 },
  dados_pessoais: { center: true, width: 1100, lineHeight: 25.2 },
  outorga: { center: true, width: 1100, lineHeight: 25.2 },
  cidade_data: { center: true, width: 1100 },
  reitor_nome: { center: true, width: 700 },
  reitor_cargo: { center: true, width: 700 },
  val_bloco: { serif: true, width: 300, lineHeight: 14.4 },
  p2_ra: { serif: true, width: 300 },
  p2_lote: { serif: true, width: 300 },
  p2_esq_mantenedora: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_esq_ies: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_esq_recred: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_esq_curso: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_esq_emec: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_esq_reconhecimento: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_dir_mantenedora: { serif: true, center: true, italic: true, width: 620, lineHeight: 17.9 },
  p2_dir_ies: { serif: true, center: true, italic: true, width: 620 },
  p2_dir_recred: { serif: true, center: true, width: 620, lineHeight: 17.9 },
  p2_dir_secretaria: { serif: true, center: true, bold: true, width: 620, lineHeight: 17.9 },
  p2_dir_registro: { serif: true, width: 520, lineHeight: 17.9 },
  p2_dir_processo: { serif: true, width: 520 },
  p2_dir_cidade_data: { serif: true, width: 420 },
  p2_dir_assinatura: { serif: true, width: 520, lineHeight: 16.5 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...UNIP_DEFAULT_POSITIONS };
  let parsed: Record<string, Partial<Pos>> | null = null;
  try {
    parsed = typeof overrides === "string"
      ? JSON.parse(overrides)
      : (overrides as Record<string, Partial<Pos>>);
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
      };
    }
  }
  return result;
}

/** Reduz a fonte quando o texto é maior que a largura útil (evita corte). */
function fitFontSize(text: string, fontSize: number, width?: number, factor = 0.5) {
  if (!width) return fontSize;
  const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  const estimated = longest * fontSize * factor;
  if (estimated <= width) return fontSize;
  return Math.max(fontSize * 0.62, (fontSize * width) / estimated);
}

/* --------------------------------------------------------------- layout */

export function buildUnipHtml(
  d: Record<string, string>,
  fieldPositions?: unknown,
  qrValue?: string,
) {
  const p = resolvePositions(fieldPositions);

  const pageOf = (id: string) => (p[id].y >= PAGE_H ? 2 : 1);
  const topOf = (id: string) => (pageOf(id) === 2 ? p[id].y - PAGE_H : p[id].y);

  const node = (id: string, inner: string, raw: string) => {
    if (!inner) return "";
    const pos = p[id];
    const st = STYLES[id] || {};
    const size = fitFontSize(raw, pos.fontSize, st.width, st.serif ? 0.48 : 0.52);
    const css: string[] = [
      `top:${topOf(id)}px`,
      `left:${pos.x}px`,
      `font-size:${size.toFixed(2)}px`,
      `line-height:${st.lineHeight ? `${st.lineHeight}px` : "1.2"}`,
      `font-family:${st.serif ? "'UnipSerif', Cambria, Georgia, serif" : "'UnipGothic', 'UnifrakturMaguntia', serif"}`,
    ];
    if (st.bold) css.push("font-weight:bold");
    if (st.italic) css.push("font-style:italic");
    if (st.width) css.push(`width:${st.width}px`);
    if (st.center) css.push("transform:translateX(-50%)", "text-align:center");
    return `<div class="ov" style="${css.join(";")}">${inner}</div>`;
  };

  const text = (id: string, value: string) => node(id, nl2br(value || ""), value || "");
  const rich = (id: string, value: string) =>
    node(id, richText(value || ""), (value || "").replace(/<\/?b>/g, ""));

  const qrBox = () => {
    if (!qrValue) return "";
    const pos = p.qr;
    return `<div class="ov qr-box" style="top:${topOf("qr")}px;left:${pos.x}px;width:${pos.w}px;height:${pos.h}px">${qrSvg(qrValue, pos.w ?? 139)}</div>`;
  };

  const sheet = (bg: string, content: string, last = false) => `
  <div class="page"${last ? ' style="page-break-after:auto"' : ""}>
    <div class="canvas">
      ${bg ? `<img class="bg" src="${escapeHtml(bg)}" />` : ""}
      ${content}
    </div>
  </div>`;

  const page1 = [
    text("inst_titulo", d.instituicao_titulo),
    text("corpo", d.corpo),
    text("titulo_conferido", d.titulo_conferido),
    text("aluno", d.aluno),
    text("dados_pessoais", d.dados_pessoais),
    text("outorga", d.outorga),
    text("cidade_data", d.cidade_data),
    text("reitor_nome", d.reitor),
    text("reitor_cargo", d.reitor_cargo),
    text("val_bloco", `${UNIP_VALIDACAO_URL}\nCódigo de Validação:\n${d.codigo_validacao}`),
  ].join("\n");

  const page2 = [
    text("p2_ra", `RA: ${d.ra}`),
    text("p2_lote", `LOTE: ${d.lote}`),
    text("p2_esq_mantenedora", `${d.mantenedora}\nCNPJ ${d.cnpj}`),
    text("p2_esq_ies", d.ies_emec),
    text("p2_esq_recred", d.recredenciamento),
    text("p2_esq_curso", d.curso_completo),
    text("p2_esq_emec", `e-MEC ${d.curso_emec}`),
    text("p2_esq_reconhecimento", d.reconhecimento),
    text("p2_dir_mantenedora", `${d.mantenedora}\nCNPJ ${d.cnpj}`),
    text("p2_dir_ies", d.ies_titulo),
    text("p2_dir_recred", d.recredenciamento),
    text("p2_dir_secretaria", "Secretaria Geral\nDepartamento de Registro de Diplomas"),
    rich("p2_dir_registro", d.registro_texto),
    rich("p2_dir_processo", `Processo nº <b>${d.processo}</b>`),
    text("p2_dir_cidade_data", d.registro_cidade_data),
    rich("p2_dir_assinatura", d.assinatura_bloco),
    qrBox(),
  ].join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<style>
  ${UNIP_FONT_FACES}
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: ${SHEET_W}px;
  }
  .page {
    width: ${SHEET_W}px;
    height: ${SHEET_H}px;
    position: relative;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
  }
  .canvas {
    position: absolute;
    top: ${OFFSET_TOP}px;
    left: 0;
    width: ${PAGE_W}px;
    height: ${PAGE_H}px;
    transform: scale(${SCALE});
    transform-origin: top left;
  }
  .bg { position: absolute; top: 0; left: 0; width: ${PAGE_W}px; height: ${PAGE_H}px; image-rendering: high-quality; }
  .ov {
    position: absolute;
    z-index: 10;
    color: #111;
    white-space: pre-wrap;
    overflow: visible;
  }
  .qr-box { background: #fff; z-index: 12; overflow: hidden; padding: 4px; }
  .qr-box svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${sheet(d.template_p1 || "", page1)}
${sheet(d.template_p2 || "", page2, true)}
</body>
</html>`;
}

/* ---------------------------------------------------------------- serve */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const codigo =
      body.codigo_validacao ||
      (await buildCodigoValidacao(
        `${body.aluno || ""}|${body.curso_completo || ""}|${body.ra || ""}|${body.registro_numero || ""}`,
      ));
    const urlValidacao = buildValidationUrl(codigo);

    const data: Record<string, string> = {
      instituicao_titulo: body.instituicao_titulo || "Universidade Paulista",
      corpo: body.corpo || "",
      titulo_conferido: body.titulo_conferido || "",
      aluno: body.aluno || "",
      dados_pessoais: body.dados_pessoais || "",
      outorga: body.outorga || "",
      cidade_data: body.cidade_data || "",
      reitor: body.reitor || "Sandra Rejane Gomes Miessa",
      reitor_cargo: body.reitor_cargo || "Reitora",
      ra: body.ra || "",
      lote: body.lote || "",
      mantenedora: body.mantenedora || "",
      cnpj: body.cnpj || "",
      ies_emec: body.ies_emec || "",
      ies_titulo: body.ies_titulo || "",
      recredenciamento: body.recredenciamento || "",
      curso_completo: body.curso_completo || "",
      curso_emec: body.curso_emec || "",
      reconhecimento: body.reconhecimento || "",
      registro_texto: body.registro_texto || "",
      processo: body.processo || "",
      registro_cidade_data: body.registro_cidade_data || "",
      assinatura_bloco: body.assinatura_bloco || "",
      codigo_validacao: codigo,
      template_p1: body.template_p1_base64 || "",
      template_p2: body.template_p2_base64 || "",
    };

    const html = buildUnipHtml(data, body.field_positions, urlValidacao);

    return new Response(
      JSON.stringify({
        success: true,
        render: "browser",
        html,
        codigo_validacao: codigo,
        documento_id: codigo,
        validation_url: urlValidacao,
        qr_code_url: urlValidacao,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating UNIP Diploma:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
