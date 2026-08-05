import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  qrSvg,
  buildCodigoValidacao,
  buildB4ValidationUrl,
  registerDiplomaB4,
  B4_BASE_URL,
} from "./validacao.ts";
import { ANHANGUERA_FONT_FACES } from "./fonts.ts";

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

function richText(value: string) {
  return escapeHtml(value)
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/\n/g, "<br/>");
}

/* ------------------------------------------------------------- geometria */

// Espaço de coordenadas do editor: 1288 x 969 por página (paisagem 791x595pt).
// A página 2 (verso) usa y a partir de 969 — o gerador subtrai o offset.
export const PAGE_W = 1288;
export const PAGE_H = 969;
const SHEET_W = 1055; // 791.33pt
const SHEET_H = 794; // 595.28pt
const SCALE = SHEET_W / PAGE_W;
const OFFSET_TOP = (SHEET_H - PAGE_H * SCALE) / 2;

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number };

export const ANHANGUERA_DEFAULT_POSITIONS: Record<string, Pos> = {
  // ---------------------------- página 1 (frente) ----------------------------
  inst_titulo: { x: 644, y: 243, fontSize: 28 },
  corpo: { x: 644, y: 339, fontSize: 15.5 },
  titulo_conferido: { x: 644, y: 448, fontSize: 21 },
  aluno: { x: 644, y: 494, fontSize: 28 },
  dados_pessoais: { x: 644, y: 541, fontSize: 15.5 },
  cidade_data: { x: 644, y: 652, fontSize: 15.5 },
  assinante_nome: { x: 644, y: 802, fontSize: 15 },
  assinante_cargo: { x: 644, y: 823, fontSize: 15 },
  val_bloco: { x: 1243, y: 868, fontSize: 14 },
  // ---------------------------- página 2 (verso) -----------------------------
  p2_curso: { x: 160, y: 1026, fontSize: 12.5 },
  p2_reconhecimento: { x: 160, y: 1057, fontSize: 12.5 },
  p2_ies: { x: 160, y: 1104, fontSize: 12.5 },
  p2_recred_ies: { x: 160, y: 1168, fontSize: 12.5 },
  p2_uniderp: { x: 160, y: 1198, fontSize: 12.5 },
  p2_recred_uniderp: { x: 160, y: 1262, fontSize: 12.5 },
  p2_registro: { x: 160, y: 1293, fontSize: 12.5 },
  p2_cidade_data: { x: 160, y: 1356, fontSize: 12.5 },
  p2_assinatura: { x: 160, y: 1387, fontSize: 12.5 },
  qr: { x: 1064, y: 1732, fontSize: 8, w: 78, h: 78 },
};

interface StyleDef {
  center?: boolean;
  right?: boolean;
  width?: number;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
}

const STYLES: Record<string, StyleDef> = {
  inst_titulo: { center: true, width: 1000, bold: true },
  corpo: { center: true, width: 1000, lineHeight: 21.2 },
  titulo_conferido: { center: true, width: 1000, bold: true, italic: true, lineHeight: 28 },
  aluno: { center: true, width: 1000, bold: true, lineHeight: 36 },
  dados_pessoais: { center: true, width: 1000, lineHeight: 21.2 },
  cidade_data: { center: true, width: 1000 },
  assinante_nome: { center: true, width: 700 },
  assinante_cargo: { center: true, width: 700 },
  val_bloco: { right: true, width: 520, lineHeight: 21.2 },
  p2_curso: { width: 1030, lineHeight: 15.8 },
  p2_reconhecimento: { width: 1030, lineHeight: 15.8 },
  p2_ies: { width: 1030, lineHeight: 15.8 },
  p2_recred_ies: { width: 1030, lineHeight: 15.8 },
  p2_uniderp: { width: 1030, lineHeight: 15.8 },
  p2_recred_uniderp: { width: 1030, lineHeight: 15.8 },
  p2_registro: { width: 1030, lineHeight: 15.8 },
  p2_cidade_data: { width: 1030, lineHeight: 15.8 },
  p2_assinatura: { width: 1030, lineHeight: 15.8 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...ANHANGUERA_DEFAULT_POSITIONS };
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

export function buildAnhangueraHtml(
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
    const size = fitFontSize(raw, pos.fontSize, st.width, 0.5);
    const css: string[] = [
      `top:${topOf(id)}px`,
      `left:${pos.x}px`,
      `font-size:${size.toFixed(2)}px`,
      `line-height:${st.lineHeight ? `${st.lineHeight}px` : "1.25"}`,
      `font-family:'AnhangueraSans', 'Poppins', Helvetica, Arial, sans-serif`,
    ];
    if (st.bold) css.push("font-weight:600");
    if (st.italic) css.push("font-style:italic");
    if (st.width) css.push(`width:${st.width}px`);
    if (st.center) css.push("transform:translateX(-50%)", "text-align:center");
    if (st.right) css.push("transform:translateX(-100%)", "text-align:right");
    return `<div class="ov" style="${css.join(";")}">${inner}</div>`;
  };

  const text = (id: string, value: string) => node(id, nl2br(value || ""), value || "");
  const rich = (id: string, value: string) =>
    node(id, richText(value || ""), (value || "").replace(/<\/?b>/g, ""));

  const qrBox = () => {
    if (!qrValue) return "";
    const pos = p.qr;
    return `<div class="ov qr-box" style="top:${topOf("qr")}px;left:${pos.x}px;width:${pos.w}px;height:${pos.h}px">${qrSvg(qrValue, pos.w ?? 78)}</div>`;
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
    text("cidade_data", d.cidade_data),
    text("assinante_nome", d.assinante_nome),
    text("assinante_cargo", d.assinante_cargo),
    text("val_bloco", `${ANHANGUERA_VALIDACAO_URL}\nCódigo de validação: ${d.codigo_validacao}`),
  ].join("\n");

  const page2 = [
    text("p2_curso", `Curso: ${d.curso}`),
    text("p2_reconhecimento", d.reconhecimento),
    text("p2_ies", `${d.instituicao_titulo}\n${d.mantenedora}\nCNPJ: ${d.cnpj}`),
    text("p2_recred_ies", d.recredenciamento_ies),
    text("p2_uniderp", `${d.universidade}\n${d.mantenedora}\nCNPJ: ${d.cnpj}`),
    text("p2_recred_uniderp", d.recredenciamento_universidade),
    rich("p2_registro", d.registro_texto),
    text("p2_cidade_data", d.registro_cidade_data),
    text("p2_assinatura", `${d.registrador_nome}\n${d.registrador_cargo}`),
    qrBox(),
  ].join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<style>
  ${ANHANGUERA_FONT_FACES}
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
    color: #1a1a2b;
    white-space: pre-wrap;
    overflow: visible;
  }
  .qr-box { background: #fff; z-index: 12; overflow: hidden; padding: 3px; }
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
        `${body.aluno || ""}|${body.curso || ""}|${body.registro_numero || ""}|${body.processo || ""}`,
      ));
    const urlValidacao = buildValidationUrl(codigo);

    const data: Record<string, string> = {
      instituicao_titulo: body.instituicao_titulo || "Faculdade Anhanguera de Macapá",
      corpo: body.corpo || "",
      titulo_conferido: body.titulo_conferido || "",
      aluno: body.aluno || "",
      dados_pessoais: body.dados_pessoais || "",
      cidade_data: body.cidade_data || "",
      assinante_nome: body.assinante_nome || "Isadora Ferreira Costa Faria",
      assinante_cargo: body.assinante_cargo || "Diretora Processos Regulatórios",
      curso: body.curso || "",
      reconhecimento: body.reconhecimento || "",
      mantenedora: body.mantenedora || "Anhanguera Educacional Participações S.A.",
      cnpj: body.cnpj || "04310392000146",
      universidade: body.universidade || "Universidade Anhanguera - Uniderp",
      recredenciamento_ies: body.recredenciamento_ies || "",
      recredenciamento_universidade: body.recredenciamento_universidade || "",
      registro_texto: body.registro_texto || "",
      registro_cidade_data: body.registro_cidade_data || "",
      registrador_nome: body.registrador_nome || "Angela Cristina Granado Willamowius",
      registrador_cargo: body.registrador_cargo || "Gerente Documentação e Diplomas",
      codigo_validacao: codigo,
      template_p1: body.template_p1_base64 || "",
      template_p2: body.template_p2_base64 || "",
    };

    const html = buildAnhangueraHtml(data, body.field_positions, urlValidacao);

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
    console.error("Error generating Anhanguera Diploma:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
