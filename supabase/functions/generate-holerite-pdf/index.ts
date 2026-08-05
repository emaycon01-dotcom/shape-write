// Holerite — Recibo de Pagamento de Salário (2 vias na mesma página A4).
// O template preserva TODO o conteúdo original (grades, rótulos, códigos e
// descrições fixas, textos verticais e linhas de assinatura). Aqui apenas
// recriamos os campos que foram removidos do documento.
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

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

/** A4 em pontos — o holerite usa 1pt = 1px no HTML. */
export const PAGE_W = 595;
export const PAGE_H = 842;

/** Linhas da tabela (as descrições fixas já vêm impressas no template). */
export const HOLERITE_ROWS: Array<{ y1: number; y2: number; label: string }> = [
  { y1: 103.24, y2: 512.13, label: "101 SALÁRIO" },
  { y1: 112.85, y2: 524.49, label: "973 INSS" },
  { y1: 123.77, y2: 536.85, label: "987 IRRF S.SALÁRIO" },
];

/**
 * Campos removidos do documento. Cada um existe nas duas vias
 * (sufixo `_a` = 1ª via, `_b` = 2ª via).
 */
export const HOLERITE_SPEC: Array<{
  key: string;
  label: string;
  sample: string;
  x: number;
  y1: number;
  y2: number;
  w: number;
  right?: boolean;
}> = [
  { key: "empresa", label: "Empresa (razão social)", sample: "JTI Brasil Ltda.", x: 32.16, y1: 35.32, y2: 437.61, w: 250 },
  { key: "cnpj", label: "CNPJ", sample: "03.334.170/0001-09", x: 65.3, y1: 45.26, y2: 449.97, w: 150 },
  { key: "competencia", label: "Mês/ano de referência", sample: "maio/2023", x: 359.11, y1: 45.26, y2: 449.97, w: 100 },

  { key: "codigo", label: "Código do funcionário", sample: "014", x: 38.16, y1: 69.28, y2: 476.25, w: 32 },
  { key: "nome", label: "Nome do funcionário", sample: "MAIARA SANTOS SILVA", x: 72.0, y1: 69.28, y2: 476.25, w: 205 },
  { key: "cargo", label: "CBO / cargo", sample: "3515-05 - Secretária", x: 284.09, y1: 69.28, y2: 476.25, w: 105 },
  { key: "emp", label: "Emp.", sample: "01", x: 329.1, y1: 69.28, y2: 476.25, w: 26 },
  { key: "local", label: "Local", sample: "01", x: 357.6, y1: 69.28, y2: 476.25, w: 26 },
  { key: "depto", label: "Depto.", sample: "01", x: 386.0, y1: 69.28, y2: 476.25, w: 30 },
  { key: "setor", label: "Setor", sample: "01", x: 418.1, y1: 69.28, y2: 476.25, w: 26 },
  { key: "secao", label: "Seção", sample: "01", x: 445.8, y1: 69.28, y2: 476.25, w: 28 },
  { key: "fl", label: "Fl.", sample: "1", x: 476.5, y1: 69.28, y2: 476.25, w: 20 },

  { key: "r1_venc", label: "Salário: vencimentos", sample: "5.000,00", x: 322.6, y1: 103.24, y2: 512.13, w: 80, right: true },
  { key: "r1_desc", label: "Salário: descontos", sample: "", x: 411.2, y1: 103.24, y2: 512.13, w: 80, right: true },
  { key: "r2_venc", label: "INSS: vencimentos", sample: "", x: 322.6, y1: 112.85, y2: 524.49, w: 80, right: true },
  { key: "r2_desc", label: "INSS: descontos", sample: "537,00", x: 411.2, y1: 112.85, y2: 524.49, w: 80, right: true },
  { key: "r3_venc", label: "IRRF: vencimentos", sample: "", x: 322.6, y1: 123.77, y2: 536.85, w: 80, right: true },
  { key: "r3_desc", label: "IRRF: descontos", sample: "368,05", x: 411.2, y1: 123.77, y2: 536.85, w: 80, right: true },

  { key: "total_venc", label: "Total de vencimentos", sample: "5.000,00", x: 312.7, y1: 309.43, y2: 748.68, w: 80, right: true },
  { key: "total_desc", label: "Total de descontos", sample: "905,05", x: 390.0, y1: 309.43, y2: 748.68, w: 80, right: true },
  { key: "liquido", label: "Valor líquido", sample: "4.094,95", x: 395.5, y1: 327.43, y2: 768.74, w: 80, right: true },

  { key: "base_salario", label: "Salário base", sample: "5.000,00", x: 40.4, y1: 357.79, y2: 801.98, w: 70 },
  { key: "base_inss", label: "Sal. contr. INSS", sample: "5.000,00", x: 129.1, y1: 357.79, y2: 801.98, w: 70 },
  { key: "base_fgts", label: "Base cálc. FGTS", sample: "5.000,00", x: 209.2, y1: 357.79, y2: 801.98, w: 70 },
  { key: "fgts_mes", label: "FGTS do mês", sample: "400,00", x: 284.1, y1: 357.79, y2: 801.98, w: 70 },
  { key: "base_irrf", label: "Base cálc. IRRF", sample: "4.603,37", x: 376.1, y1: 357.79, y2: 801.98, w: 70 },
  { key: "faixa_irrf", label: "Faixa IRRF", sample: "04", x: 461.4, y1: 357.79, y2: 801.98, w: 30 },
];

const FONT_SIZE = 9.2;

function buildDefaults(): Record<string, Pos> {
  const base: Record<string, Pos> = {};
  for (const f of HOLERITE_SPEC) {
    base[`${f.key}_a`] = { x: f.x, y: f.y1, fontSize: FONT_SIZE, w: f.w };
    base[`${f.key}_b`] = { x: f.x, y: f.y2, fontSize: FONT_SIZE, w: f.w };
  }
  return base;
}

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultHoleriteFields
export const HOLERITE_DEFAULT_POSITIONS: Record<string, Pos> = buildDefaults();

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...HOLERITE_DEFAULT_POSITIONS };
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

/** Reduz a fonte quando o texto é longo demais — nunca corta com "…". */
function fitTextStyle(value: string, baseSize: number, maxWidth: number, minRatio = 0.55) {
  const len = (value || "").trim().length;
  if (!len || !maxWidth) return "";
  const charRatio = 0.6; // fonte monoespaçada
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- layout */

export function buildHoleriteHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const p = resolvePositions(fieldPositions);
  const bg1 = d.template_bg || "";

  const RIGHT = new Set(HOLERITE_SPEC.filter((f) => f.right).map((f) => f.key));

  const field = (key: string, via: "a" | "b", text: string) => {
    const id = `${key}_${via}`;
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 120;
    const fit = fitTextStyle(text, pos.fontSize, width);
    const align = RIGHT.has(key) ? "right" : "left";
    return `<div class="ov" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};">${escapeHtml(text)}</div>`;
  };

  const via = (v: "a" | "b") => HOLERITE_SPEC.map((f) => field(f.key, v, d[f.key] || "")).join("\n  ");

  const head = `
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: ${PAGE_W}px;
    font-family: 'DejaVu Sans Mono', 'Liberation Mono', 'Courier New', monospace;
  }
  .page { width: ${PAGE_W}px; height: ${PAGE_H}px; position: relative; background: #fff; overflow: hidden; }
  .bg { position: absolute; inset: 0; z-index: 0; }
  .bg img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .ov { position: absolute; z-index: 10; color: #111; line-height: 1; overflow: visible; white-space: nowrap; }
</style>`;

  return `<!DOCTYPE html>
<html>
<head>${head}</head>
<body>
<div class="page">
  <div class="bg">${bg1 ? `<img src="${escapeHtml(bg1)}" />` : ""}</div>

  ${via("a")}

  ${via("b")}
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

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const f of HOLERITE_SPEC) {
      data[f.key] = typeof body[f.key] === "string" ? body[f.key] : String(body[f.key] ?? "");
    }

    const html = buildHoleriteHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Holerite:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
