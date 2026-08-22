import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

/** Página no tamanho real da notificação (518,74 x 255,12 pt → px @96dpi). */
export const RECEITA_AZUL_PAGE = { width: 691.65, height: 340.16 };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultReceitaAzulFields
export const RECEITA_AZUL_DEFAULT_POSITIONS: Record<string, Pos> = {
  uf: { x: 33, y: 57, fontSize: 15.2, w: 28 },
  numero: { x: 96, y: 56.5, fontSize: 18, w: 92 },
  serie: { x: 106, y: 74.2, fontSize: 6.7, w: 40 },
  medico: { x: 226, y: 44.5, fontSize: 14.7, w: 267 },
  crm: { x: 226, y: 61.8, fontSize: 11.7, w: 267 },
  clinica_linha1: { x: 226, y: 93.8, fontSize: 10.4, w: 267 },
  clinica_linha2: { x: 226, y: 105.8, fontSize: 10.4, w: 267 },
  dia: { x: 38, y: 105.5, fontSize: 22, w: 42 },
  mes: { x: 69, y: 106.5, fontSize: 21, w: 62 },
  ano: { x: 138, y: 105.5, fontSize: 22, w: 60 },
  paciente: { x: 270, y: 123.5, fontSize: 20, w: 222 },
  endereco_linha1: { x: 280, y: 162.5, fontSize: 14, w: 218 },
  endereco_linha2: { x: 225, y: 180, fontSize: 12.6, w: 272 },
  medicamento: { x: 494, y: 40, fontSize: 27, w: 174 },
  quantidade: { x: 492, y: 76.5, fontSize: 17, w: 178 },
  dose: { x: 494, y: 130, fontSize: 20, w: 174 },
  posologia: { x: 496, y: 167.5, fontSize: 15, w: 172 },
  numeracao: { x: 541, y: 299.5, fontSize: 6.7, w: 132 },
  autorizacao_data: { x: 647, y: 307.5, fontSize: 5.2, w: 26 },
};

/** Campos escritos com a fonte manuscrita azul. */
const SCRIPT_FIELDS = new Set([
  "dia", "mes", "ano", "paciente", "endereco_linha1", "endereco_linha2",
  "medicamento", "quantidade", "dose", "posologia",
]);

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...RECEITA_AZUL_DEFAULT_POSITIONS };
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

/* ------------------------------------------------------------ auto-fit */

/** Reduz a fonte quando o texto não cabe na caixa, sem cortar com reticências. */
function fitTextStyle(text: string, boxWidth: number, fontSize: number, factor = 0.42) {
  const len = (text || "").length;
  if (!len || !boxWidth) return `font-size:${fontSize}px;`;
  const max = boxWidth / (fontSize * factor);
  const size = len > max ? Math.max(fontSize * (max / len), fontSize * 0.5) : fontSize;
  return `font-size:${size.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- layout */

export function buildReceitaAzulHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const block = (id: string, value: string, extra = "") => {
    const pos = p[id];
    if (!pos || !value) return "";
    const script = SCRIPT_FIELDS.has(id);
    const width = pos.w ? `width:${pos.w}px;` : "";
    const cls = script ? "overlay script" : "overlay";
    const fit = pos.w ? fitTextStyle(value, pos.w, pos.fontSize, script ? 0.34 : 0.5) : `font-size:${pos.fontSize}px;`;
    return `<div class="${cls}" style="top:${pos.y}px;left:${pos.x}px;${width}${fit}${extra}">${escapeHtml(value)}</div>`;
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<style>
  @page { size: ${RECEITA_AZUL_PAGE.width}px ${RECEITA_AZUL_PAGE.height}px; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: ${RECEITA_AZUL_PAGE.width}px;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .page {
    width: ${RECEITA_AZUL_PAGE.width}px;
    height: ${RECEITA_AZUL_PAGE.height}px;
    position: relative;
    background: #fff;
    overflow: hidden;
  }
  .bg-template { position: absolute; inset: 0; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay {
    position: absolute;
    z-index: 10;
    color: #231f20;
    line-height: 1.15;
    text-align: center;
    overflow: visible;
  }
  .script {
    font-family: 'ReceitaScript', 'Segoe Script', cursive;
    color: #2e3092;
    line-height: 1.05;
  }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${block("uf", d.uf || "")}
  ${block("numero", d.numero || "", "font-weight:normal;letter-spacing:0.4px;")}
  ${block("serie", d.serie ? `SÉRIE ${d.serie}` : "")}

  ${block("medico", d.medico || "")}
  ${block("crm", d.crm || "")}
  ${block("clinica_linha1", d.clinica_linha1 || "")}
  ${block("clinica_linha2", d.clinica_linha2 || "")}

  ${block("dia", d.dia || "")}
  ${block("mes", d.mes || "")}
  ${block("ano", d.ano || "")}

  ${block("paciente", d.paciente || "")}
  ${block("endereco_linha1", d.endereco_linha1 || "")}
  ${block("endereco_linha2", d.endereco_linha2 || "")}

  ${block("medicamento", d.medicamento || "")}
  ${block("quantidade", d.quantidade || "")}
  ${block("dose", d.dose || "")}
  ${block("posologia", d.posologia || "")}

  ${block("numeracao", d.numeracao || "", "text-align:right;")}
  ${block("autorizacao_data", d.autorizacao_data || "", "text-align:left;")}
</div>
</body>
</html>`;
}

/* ---------------------------------------------------------------- serve */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const keys = [
      "uf", "numero", "serie", "medico", "crm", "clinica_linha1", "clinica_linha2",
      "dia", "mes", "ano", "paciente", "endereco_linha1", "endereco_linha2",
      "medicamento", "quantidade", "dose", "posologia", "numeracao", "autorizacao_data",
    ];

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildReceitaAzulHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Receita Azul:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
