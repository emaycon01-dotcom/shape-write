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

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number };

/**
 * Página A4 PAISAGEM: 1123 x 794 px (96 dpi).
 * As coordenadas vieram do documento oficial (pts * 1123/842) e os blocos são
 * CENTRALIZADOS dentro da coluna correspondente do template.
 *
 * Defaults MUST match src/pages/PorteFormPage.tsx / porte-align.ts.
 */
export const PORTE_DEFAULT_POSITIONS: Record<string, Pos> = {
  certificado: { x: 82, y: 151, fontSize: 10, w: 118 },
  expedicao: { x: 204, y: 151, fontSize: 10, w: 110 },
  categoria: { x: 310, y: 151, fontSize: 10, w: 132 },
  via: { x: 418, y: 151, fontSize: 10, w: 42 },

  nome: { x: 130, y: 187, fontSize: 10, w: 300 },
  abrangencia: { x: 130, y: 220, fontSize: 10, w: 300 },

  arma_numero: { x: 108, y: 257, fontSize: 10, w: 98 },
  especie: { x: 210, y: 257, fontSize: 10, w: 98 },
  marca: { x: 285, y: 257, fontSize: 10, w: 96 },
  calibre: { x: 342, y: 257, fontSize: 10, w: 96 },
  fabricacao: { x: 400, y: 257, fontSize: 10, w: 78 },

  data_expedicao: { x: 92, y: 293, fontSize: 10, w: 92 },
  validade: { x: 205, y: 293, fontSize: 10, w: 92 },
  identidade: { x: 330, y: 293, fontSize: 10, w: 120 },

  assinante: { x: 178, y: 314, fontSize: 5.2, w: 100 },
  cargo: { x: 165, y: 321, fontSize: 5.2, w: 126 },
  unidade: { x: 228, y: 327, fontSize: 5.2, w: 100 },

  numero_porte: { x: 900, y: 305, fontSize: 6.3, w: 130 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...PORTE_DEFAULT_POSITIONS };
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

/** Evita truncamento: reduz a fonte quando o texto não cabe na coluna. */
export function fitTextStyle(text: string, width: number, fontSize: number, avgCharRatio = 0.54): string {
  const len = (text || "").length;
  if (!len || !width) return `font-size:${fontSize}px;`;
  const estimated = len * fontSize * avgCharRatio;
  if (estimated <= width) return `font-size:${fontSize}px;`;
  const scaled = Math.max(fontSize * 0.6, width / (len * avgCharRatio));
  return `font-size:${scaled.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- layout */

export function buildPorteHtml(d: Record<string, string>, fieldPositions: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const block = (id: string, value: string, extra = "") => {
    const pos = p[id];
    const text = (value || "").trim();
    if (!pos || !text) return "";
    const width = pos.w ?? 120;
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;${fitTextStyle(text, width, pos.fontSize)}${extra}">${escapeHtml(text)}</div>`;
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: 1123px;
    margin: 0;
    padding: 0;
    /* Fonte fina e SEM negrito (diferente do CRAF, que usa Arial bold). */
    font-family: 'Helvetica Neue', Helvetica, 'Liberation Sans', Arial, sans-serif;
    font-weight: 400;
  }
  .page { width: 1123px; height: 794px; position: relative; background: #fff; overflow: hidden; }
  .bg-template { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay {
    position: absolute;
    z-index: 10;
    color: #111;
    line-height: 1.15;
    white-space: nowrap;
    overflow: visible;
    text-align: center;
    font-weight: 400;
    letter-spacing: 0.15px;
  }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${block("certificado", d.certificado)}
  ${block("expedicao", d.expedicao)}
  ${block("categoria", d.categoria)}
  ${block("via", d.via)}

  ${block("nome", d.nome)}
  ${block("abrangencia", d.abrangencia || "VALIDO EM TODO TERRITÓRIO NACIONAL")}

  ${block("arma_numero", d.arma_numero)}
  ${block("especie", d.especie)}
  ${block("marca", d.marca)}
  ${block("calibre", d.calibre)}
  ${block("fabricacao", d.fabricacao)}

  ${block("data_expedicao", d.data_expedicao)}
  ${block("validade", d.validade)}
  ${block("identidade", d.identidade)}

  ${block("assinante", d.assinante)}
  ${block("cargo", d.cargo)}
  ${block("unidade", d.unidade || d.expedicao)}

  ${block("numero_porte", d.numero_porte ? `Nº do Porte: ${d.numero_porte}` : "")}
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
      "certificado", "expedicao", "categoria", "via",
      "nome", "abrangencia",
      "arma_numero", "especie", "marca", "calibre", "fabricacao",
      "data_expedicao", "validade", "identidade",
      "assinante", "cargo", "unidade", "numero_porte",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildPorteHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating PORTE:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
