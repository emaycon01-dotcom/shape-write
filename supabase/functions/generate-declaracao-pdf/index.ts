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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultDeclaracaoFields
export const DECLARACAO_DEFAULT_POSITIONS: Record<string, Pos> = {
  brasao: { x: 372, y: 47, fontSize: 10, w: 55, h: 65 },
  gov_estado: { x: 97, y: 116.5, fontSize: 14.7, w: 600 },
  secretaria: { x: 97, y: 136, fontSize: 14.7, w: 600 },
  corpo: { x: 112.6, y: 292, fontSize: 16, w: 570 },
  data_local: { x: 97, y: 623, fontSize: 16, w: 600 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...DECLARACAO_DEFAULT_POSITIONS };
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
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "04/12/2022" -> "04 de Dezembro de 2022" */
export function dataPorExtenso(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return (data || "").trim();
  const mes = MESES[Number(m[2]) - 1] || "";
  return `${m[1]} de ${mes} de ${m[3]}`;
}

/** Corpo da declaração, com os dados variáveis em negrito. */
export function buildCorpoHtml(d: Record<string, string>): string {
  const b = (v: string) => `<b>${escapeHtml((v || "").trim())}</b>`;
  const termino = (d.data_termino || "").trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(termino);
  const diaTermino = m ? m[1] : termino;
  const mesTermino = m ? (MESES[Number(m[2]) - 1] || "").toUpperCase() : (d.mes_termino || "");
  const anoTermino = m ? m[3] : (d.ano_letivo || "");

  return (
    `<span style="display:inline-block;width:56px;"></span>` +
    `Declaro para os devidos fins de direito que ${b(d.nome_aluno)}, natural de ${b(d.naturalidade)}, ` +
    `nascido (a) em ${b(d.data_nasc)}, filho (a) legítima de ${b(d.mae)} e ${b(d.pai)}, ` +
    `<b>CONCLUIU</b> o ${b(d.serie)} do ${b(d.nivel_ensino)} ${b(d.modalidade)} neste estabelecimento de ensino ` +
    `${b(d.escola)}, no ano letivo de ${b(d.ano_letivo)}. Cujo término do ano letivo aconteceu no dia ` +
    `${b(diaTermino)} de ${b(mesTermino)} de ${b(anoTermino)} com apresentação do Resultado Final.` +
    `<br/>Por ser verdade firmo a presente declaração.`
  );
}

/* --------------------------------------------------------------- layout */

export function buildDeclaracaoHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const block = (id: string, html: string, extra = "") => {
    const pos = p[id];
    if (!pos || !html) return "";
    const width = pos.w ?? 400;
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${extra}">${html}</div>`;
  };

  const uf = (d.uf || "SP").toUpperCase();
  const govEstado = d.gov_estado || `GOVERNO DO ESTADO DE ${(d.estado_nome || "").toUpperCase()}`;
  const dataLocal =
    `${dataPorExtenso(d.data_emissao || "")}, ${(d.cidade || "").trim()}${uf ? ` - ${uf}` : ""}`;

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
    text-rendering: geometricPrecision;
    background: #fff;
    width: 794px;
    margin: 0;
    padding: 0;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .bg-template { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay { position: absolute; z-index: 10; color: #111; line-height: 1.2; white-space: normal; overflow: visible; }
  .center { text-align: center; }
  .corpo { text-align: justify; line-height: 1.72; }
  .brasao { display: flex; align-items: center; justify-content: center; }
  .brasao img { width: 100%; height: 100%; object-fit: contain; image-rendering: high-quality; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <!-- brasão do estado -->
  ${d.brasao_base64 && p.brasao
      ? `<div class="overlay brasao" style="top:${p.brasao.y}px;left:${p.brasao.x}px;width:${p.brasao.w ?? 55}px;height:${p.brasao.h ?? 65}px;"><img src="${escapeHtml(d.brasao_base64)}" /></div>`
      : ""}

  ${block("gov_estado", escapeHtml(govEstado), "text-align:center;")}
  ${block("secretaria", escapeHtml(d.secretaria || "SECRETARIA DE ESTADO DA EDUCAÇÃO"), "text-align:center;")}

  <div class="overlay corpo" style="top:${p.corpo.y}px;left:${p.corpo.x}px;width:${p.corpo.w ?? 570}px;font-size:${p.corpo.fontSize}px;">${buildCorpoHtml(d)}</div>

  ${block("data_local", escapeHtml(dataLocal), "text-align:center;")}
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
      "gov_estado", "secretaria", "estado_nome", "uf", "cidade",
      "nome_aluno", "naturalidade", "data_nasc", "mae", "pai",
      "serie", "nivel_ensino", "modalidade", "escola",
      "ano_letivo", "data_termino", "mes_termino", "data_emissao",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
      brasao_base64: typeof body.brasao_base64 === "string" ? body.brasao_base64 : "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildDeclaracaoHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Declaração Escolar:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
