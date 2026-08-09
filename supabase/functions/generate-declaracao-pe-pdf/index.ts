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

/** Remove caracteres invisíveis e normaliza para evitar glifos sobrepostos. */
function cleanSingleLine(value: string) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultDeclaracaoPeFields
export const DECLARACAO_PE_DEFAULT_POSITIONS: Record<string, Pos> = {
  corpo: { x: 86, y: 320, fontSize: 16, w: 630 },
  data_local: { x: 386, y: 620, fontSize: 16, w: 330 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...DECLARACAO_PE_DEFAULT_POSITIONS };
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

/* --------------------------------------------------------------- textos */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "15/08/2022" -> "15 de agosto de 2022" */
export function dataPorExtenso(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return (data || "").trim();
  const mes = MESES[Number(m[2]) - 1] || "";
  return `${Number(m[1])} de ${mes} de ${m[3]}`;
}

/** Corpo da Declaração Escolar (papel timbrado da Secretaria de Educação). */
export function buildCorpoPeHtml(d: Record<string, string>): string {
  const b = (v: string) => `<b>${escapeHtml(cleanSingleLine(v))}</b>`;
  const t = (v: string) => escapeHtml(cleanSingleLine(v));

  const filiacao = [d.pai, d.mae].map((v) => cleanSingleLine(v)).filter(Boolean);
  const filiacaoTxt = filiacao.length
    ? `filho (a) de ${filiacao.map((v) => escapeHtml(v)).join(" e de ")}, `
    : "";

  const turno = cleanSingleLine(d.turno) ? `, no turno da ${t(d.turno)}` : "";
  const horario = cleanSingleLine(d.horario) ? `, no horário das ${t(d.horario)}` : "";

  return (
    `<span style="display:inline-block;width:56px;"></span>` +
    `Declaramos para os devidos fins que ${b(d.nome_aluno)}, ` +
    `portador (a) da cédula de identidade nº ${t(d.rg)} ${t(d.orgao_emissor)} e C.P.F nº ${t(d.cpf)}, ` +
    filiacaoTxt +
    `encontra-se ${t(d.situacao)} no ${t(d.serie)} do ${t(d.nivel_ensino)} ` +
    `na ${b(d.escola)}${turno}${horario}, no ano letivo de ${t(d.ano_letivo)}.`
  );
}

/* --------------------------------------------------------------- layout */

export function buildDeclaracaoPeHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const dataLocal = `${cleanSingleLine(d.cidade)}, ${dataPorExtenso(d.data_emissao || "")}.`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    background: #fff;
    width: 794px;
    margin: 0;
    padding: 0;
    font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .bg-template { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay {
    position: absolute; z-index: 10; color: #000; line-height: 1.2; white-space: normal; overflow: visible;
    font-kerning: none; font-variant-ligatures: none; letter-spacing: 0; overflow-wrap: break-word; word-break: normal;
  }
  .corpo { text-align: left; line-height: 2.0; text-justify: none; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <div class="overlay corpo" style="top:${p.corpo.y}px;left:${p.corpo.x}px;width:${p.corpo.w ?? 630}px;font-size:${p.corpo.fontSize}px;">${buildCorpoPeHtml(d)}</div>

  <div class="overlay" style="top:${p.data_local.y}px;left:${p.data_local.x}px;width:${p.data_local.w ?? 330}px;font-size:${p.data_local.fontSize}px;text-align:right;">${escapeHtml(dataLocal)}</div>
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
      "nome_aluno", "rg", "orgao_emissor", "cpf", "pai", "mae",
      "situacao", "serie", "nivel_ensino", "escola", "turno", "horario",
      "ano_letivo", "cidade", "data_emissao",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildDeclaracaoPeHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Declaração Escolar (PE):", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
