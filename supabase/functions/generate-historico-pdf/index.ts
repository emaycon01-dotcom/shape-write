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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultHistoricoFields
export const HISTORICO_DEFAULT_POSITIONS: Record<string, Pos> = {
  brasao: { x: 108, y: 34, fontSize: 10, w: 80, h: 90 },
  gov_estado: { x: 203.1, y: 38.4, fontSize: 15.5, w: 400 },
  secretaria: { x: 203.1, y: 59.1, fontSize: 12, w: 400 },
  diretoria: { x: 203.1, y: 77.4, fontSize: 12, w: 400 },
  escola: { x: 198.3, y: 93.4, fontSize: 13, w: 470 },
  ato_legal: { x: 203.1, y: 111, fontSize: 10.8, w: 400 },
  endereco: { x: 203.1, y: 125.4, fontSize: 10.8, w: 420 },
  numero: { x: 645.5, y: 125.4, fontSize: 10.8 },
  bairro: { x: 203.1, y: 139.9, fontSize: 10.8 },
  municipio_escola: { x: 366.1, y: 139.9, fontSize: 10.8 },
  cep: { x: 609.7, y: 139.9, fontSize: 10.8 },
  telefone: { x: 201.7, y: 163.5, fontSize: 10.8 },

  nome_aluno: { x: 153.8, y: 222.2, fontSize: 12, w: 290 },
  rg_rne: { x: 459.4, y: 222.3, fontSize: 11, w: 150 },
  ra: { x: 614.3, y: 222.2, fontSize: 12, w: 165 },
  municipio_nasc: { x: 198.3, y: 238.2, fontSize: 12, w: 250 },
  estado_nasc: { x: 459.4, y: 238.2, fontSize: 12, w: 145 },
  pais: { x: 614.3, y: 238.2, fontSize: 12, w: 165 },
  data_nasc: { x: 198.3, y: 254.2, fontSize: 12, w: 250 },
  mae: { x: 459.4, y: 254.2, fontSize: 12, w: 320 },

  ano1: { x: 545.6, y: 273.3, fontSize: 11 },
  ano2: { x: 595.5, y: 273.3, fontSize: 11 },
  ano3: { x: 645.4, y: 273.3, fontSize: 11 },

  ef_ano: { x: 256.5, y: 743.4, fontSize: 11 },
  ef_estab: { x: 294.6, y: 736.4, fontSize: 11, w: 292 },
  ef_mun: { x: 613.9, y: 743.4, fontSize: 11, w: 82 },
  ef_uf: { x: 704, y: 743.4, fontSize: 11 },

  e1_ano: { x: 256.5, y: 769.4, fontSize: 11 },
  e1_estab: { x: 294.6, y: 769.4, fontSize: 11, w: 292 },
  e1_mun: { x: 615, y: 769.4, fontSize: 11, w: 82 },
  e1_uf: { x: 705, y: 769.4, fontSize: 11 },

  e2_ano: { x: 256.5, y: 783.9, fontSize: 11 },
  e2_estab: { x: 294.6, y: 783.9, fontSize: 11, w: 292 },
  e2_mun: { x: 615, y: 783.9, fontSize: 11, w: 82 },
  e2_uf: { x: 705, y: 783.9, fontSize: 11 },

  e3_ano: { x: 256.5, y: 798.3, fontSize: 11 },
  e3_estab: { x: 294.6, y: 798.3, fontSize: 11, w: 292 },
  e3_mun: { x: 615, y: 798.3, fontSize: 11, w: 82 },
  e3_uf: { x: 705, y: 798.3, fontSize: 11 },

  certificado: { x: 47.1, y: 858.3, fontSize: 12, w: 680 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...HISTORICO_DEFAULT_POSITIONS };
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
  const charRatio = 0.5;
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- textos */

export function buildCertificadoText(d: Record<string, string>): string {
  const escola = (d.escola || "").trim();
  const nome = (d.nome_aluno || "").trim();
  const serie = (d.serie_conclusao || "3ª").trim();
  const ano = (d.ano_conclusao || "").trim();
  return (
    `O Diretor da Escola, ${escola}, CERTIFICA, nos termos do Inciso VII, Artigo 24 da Lei Federal ` +
    `9394/96, que ${nome}, CONCLUIU a ${serie} Série do Ensino Médio REGULAR no ano de ${ano}.`
  );
}

/* --------------------------------------------------------------- layout */

export function buildHistoricoHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  /** Campo de linha única (sem quebra), com auto-ajuste de fonte. */
  const line = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos) return "";
    const fit = pos.w ? fitTextStyle(text, pos.fontSize, pos.w) : "";
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;${fit}${extra}">${escapeHtml(text)}</div>`;
  };

  /** Campo com quebra de linha dentro de uma largura. */
  const block = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos) return "";
    return `<div class="overlay txt" style="top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;width:${pos.w ?? 300}px;${extra}">${escapeHtml(text)}</div>`;
  };

  const linhaEstudo = (prefixo: string, ano: string, estab: string, mun: string, uf: string) =>
    [
      line(`${prefixo}_ano`, ano),
      block(`${prefixo}_estab`, estab),
      line(`${prefixo}_mun`, mun),
      line(`${prefixo}_uf`, uf),
    ].join("\n");

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
  .overlay {
    position: absolute;
    z-index: 10;
    color: #111;
    line-height: 1;
    white-space: nowrap;
    overflow: visible;
    text-overflow: clip;
  }
  .txt { white-space: normal; line-height: 1.22; text-align: left; }
  .brasao { display: flex; align-items: center; justify-content: center; }
  .brasao img { width: 100%; height: 100%; object-fit: contain; image-rendering: high-quality; }
  .cert { text-align: justify; line-height: 1.28; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <!-- brasão do estado (canto superior esquerdo) -->
  ${d.brasao_base64 && p.brasao
      ? `<div class="overlay brasao" style="top:${p.brasao.y}px;left:${p.brasao.x}px;width:${p.brasao.w ?? 80}px;height:${p.brasao.h ?? 90}px;"><img src="${escapeHtml(d.brasao_base64)}" /></div>`
      : ""}

  <!-- cabeçalho da escola -->
  ${line("gov_estado", d.gov_estado || "GOVERNO DO ESTADO DE ALAGOAS", "font-weight:700;")}
  ${line("secretaria", d.secretaria || "SECRETARIA DE ESTADO DA EDUCAÇÃO")}
  ${line("diretoria", d.diretoria || "DIRETORIA DE ENSINO – REGIÃO DE AL")}
  ${line("escola", (d.escola || "").toUpperCase())}
  ${line("ato_legal", `Ato Legal de Criação: ${d.ato_legal || ""}`)}
  ${line("endereco", `Endereço: ${d.endereco || ""}`)}
  ${line("numero", `nº ${d.numero || ""}`)}
  ${line("bairro", `Bairro: ${d.bairro || ""}`)}
  ${line("municipio_escola", `Município: ${d.municipio_escola || ""}`)}
  ${line("cep", `CEP: ${d.cep || ""}`)}
  ${line("telefone", `Tell: ${d.telefone || ""}`)}

  <!-- identificação do aluno -->
  ${line("nome_aluno", d.nome_aluno || "")}
  ${line("rg_rne", `RG/RNE: ${d.rg_rne || ""}`)}
  ${line("ra", `RA: ${d.ra || ""}`)}
  ${line("municipio_nasc", `Município: ${d.municipio_nasc || ""}`)}
  ${line("estado_nasc", `Estado: ${d.estado_nasc || ""}`)}
  ${line("pais", `País: ${d.pais || "Brasil"}`)}
  ${line("data_nasc", `Data: ${d.data_nasc || ""}`)}
  ${line("mae", `Mãe: ${d.mae || ""}`)}

  <!-- anos das séries do quadro de notas -->
  ${line("ano1", d.ano1 || "")}
  ${line("ano2", d.ano2 || "")}
  ${line("ano3", d.ano3 || "")}

  <!-- estudos realizados -->
  ${linhaEstudo("ef", d.ef_ano || "", d.ef_estab || "", d.ef_mun || "", d.ef_uf || "")}
  ${linhaEstudo("e1", d.e1_ano || "", d.e1_estab || "", d.e1_mun || "", d.e1_uf || "")}
  ${linhaEstudo("e2", d.e2_ano || "", d.e2_estab || "", d.e2_mun || "", d.e2_uf || "")}
  ${linhaEstudo("e3", d.e3_ano || "", d.e3_estab || "", d.e3_mun || "", d.e3_uf || "")}

  <!-- certificado -->
  ${block("certificado", buildCertificadoText(d), "text-align:justify;line-height:1.28;")}
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
      "gov_estado", "secretaria", "diretoria", "escola", "ato_legal", "endereco", "numero",
      "bairro", "municipio_escola", "cep", "telefone",
      "nome_aluno", "rg_rne", "ra", "municipio_nasc", "estado_nasc", "pais", "data_nasc", "mae",
      "ano1", "ano2", "ano3",
      "ef_ano", "ef_estab", "ef_mun", "ef_uf",
      "e1_ano", "e1_estab", "e1_mun", "e1_uf",
      "e2_ano", "e2_estab", "e2_mun", "e2_uf",
      "e3_ano", "e3_estab", "e3_mun", "e3_uf",
      "serie_conclusao", "ano_conclusao",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
      brasao_base64: typeof body.brasao_base64 === "string" ? body.brasao_base64 : "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildHistoricoHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Histórico Escolar:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
