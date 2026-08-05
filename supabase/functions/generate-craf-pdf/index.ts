import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { buildAutenticidade, buildValidacaoUrl, qrSvg, registerCrafDocument } from "./validacao.ts";


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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultCrafFields
export const CRAF_DEFAULT_POSITIONS: Record<string, Pos> = {
  validade: { x: 212, y: 138, fontSize: 9.5, w: 120 },
  nome: { x: 215, y: 173, fontSize: 9, w: 262 },
  cpf: { x: 215, y: 209, fontSize: 9, w: 95 },
  rg: { x: 313.6, y: 210.5, fontSize: 9, w: 100 },
  sfpc: { x: 421.7, y: 210.5, fontSize: 9, w: 130 },
  amparo: { x: 215, y: 243, fontSize: 8.5, w: 350 },

  registro: { x: 403, y: 402, fontSize: 7.5, w: 162 },
  tipo: { x: 405.7, y: 432, fontSize: 8, w: 70 },
  marca: { x: 483, y: 432, fontSize: 8.5, w: 82 },
  calibre: { x: 405.7, y: 456, fontSize: 8.5, w: 76 },
  numero_serie: { x: 405.7, y: 481.5, fontSize: 8.5, w: 76 },
  numero_sigma: { x: 483, y: 483, fontSize: 8.5, w: 82 },
  data_expedicao: { x: 405.7, y: 505.5, fontSize: 8.5, w: 76 },

  assinado_por: { x: 400.4, y: 536.5, fontSize: 8.5, w: 200 },
  assinante: { x: 400.4, y: 551, fontSize: 8.5, w: 200 },
  cidade_data: { x: 400.4, y: 564.5, fontSize: 8.5, w: 200 },

  qr: { x: 225.8, y: 411, fontSize: 8, w: 137, h: 137 },
  qr_label: { x: 258, y: 578, fontSize: 8.5, w: 120 },
  autenticidade: { x: 258, y: 590.5, fontSize: 8.5, w: 260 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...CRAF_DEFAULT_POSITIONS };
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

/* ---------------------------------------------------------- ajuste fino */

/**
 * Evita truncamento com "…": reduz a fonte proporcionalmente quando o texto
 * é maior que a largura reservada (mesmo padrão dos demais módulos).
 */
export function fitTextStyle(text: string, width: number, fontSize: number, avgCharRatio = 0.56): string {
  const len = (text || "").length;
  if (!len || !width) return `font-size:${fontSize}px;`;
  const estimated = len * fontSize * avgCharRatio;
  if (estimated <= width) return `font-size:${fontSize}px;`;
  const scaled = Math.max(fontSize * 0.62, (width / (len * avgCharRatio)));
  return `font-size:${scaled.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- layout */

export function buildCrafHtml(
  d: Record<string, string>,
  fieldPositions: unknown,
  qrDataUrl: string,
  autenticidade: string,
) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const block = (id: string, value: string, extra = "") => {
    const pos = p[id];
    const text = (value || "").trim();
    if (!pos || !text) return "";
    const width = pos.w ?? 200;
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;${fitTextStyle(text, width, pos.fontSize)}${extra}">${escapeHtml(text)}</div>`;
  };

  const qrPos = p.qr;
  const qrHtml = qrDataUrl && qrPos
    ? `<div class="overlay qr" style="top:${qrPos.y}px;left:${qrPos.x}px;width:${qrPos.w ?? 137}px;height:${qrPos.h ?? 137}px;"><img src="${qrDataUrl}" /></div>`
    : "";

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
  .overlay { position: absolute; z-index: 10; color: #111; line-height: 1.2; white-space: nowrap; overflow: visible; }
  .wrap { white-space: normal; }
  .qr { display: flex; align-items: center; justify-content: center; background: #fff; }
  .qr img { width: 100%; height: 100%; image-rendering: pixelated; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <!-- frente -->
  ${block("validade", d.validade)}
  ${block("nome", d.nome)}
  ${block("cpf", d.cpf)}
  ${block("rg", d.rg)}
  ${block("sfpc", d.sfpc)}
  ${block("amparo", d.amparo || "art. 3º da Lei 10.826/03 e art. 4 do Decreto 9.847/19.")}

  <!-- verso -->
  ${block("registro", d.registro)}
  ${block("tipo", d.tipo)}
  ${block("marca", d.marca)}
  ${block("calibre", d.calibre)}
  ${block("numero_serie", d.numero_serie)}
  ${block("numero_sigma", d.numero_sigma)}
  ${block("data_expedicao", d.data_expedicao)}

  ${block("assinado_por", "Documento Assinado Eletrônicamente por:")}
  ${block("assinante", d.assinante || d.sfpc)}
  ${block("cidade_data", `${(d.cidade || "").trim()}${d.cidade ? ", " : ""}${d.data_expedicao || ""}`)}

  ${qrHtml}
  ${block("qr_label", "QR Code Vio")}
  ${block("autenticidade", `A Autenticidade no SisGCorp ${autenticidade}`)}
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
      "validade", "nome", "cpf", "rg", "sfpc", "amparo",
      "registro", "tipo", "marca", "calibre",
      "numero_serie", "numero_sigma", "data_expedicao",
      "assinante", "cidade",
    ];

    const data: Record<string, string> = {
      template_bg: body.template_base64 || "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const fotoBase64 = typeof body.foto_base64 === "string" ? body.foto_base64 : "";

    const autenticidade = await buildAutenticidade(data);

    // Cadastra no validador Vio ANTES de montar o PDF; o QR usa SEMPRE a URL oficial.
    const reg = await registerCrafDocument(data, fotoBase64);
    if (!reg.registered || !reg.qrCodeUrl) {
      console.error("CRAF não registrado no validador:", reg.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Não foi possível registrar o CRAF no validador: ${reg.error || "resposta inválida"}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = reg.qrCodeUrl;
    const qrDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(qrSvg(url, 512))))}`;

    const html = buildCrafHtml(data, body.field_positions, qrDataUrl, autenticidade);

    return new Response(
      JSON.stringify({
        success: true,
        render: "browser",
        html,
        autenticidade,
        documento_id: reg.documentoId,
        validacao_url: url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: unknown) {
    console.error("Error generating CRAF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
