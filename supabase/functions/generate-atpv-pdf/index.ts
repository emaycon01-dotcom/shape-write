import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { qrSvg, registerValidationDocument, buildDocumentoId } from "./validacao.ts";
import { ATPV_FONT_FACE } from "./atpv-font.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultAtpvFields
export const ATPV_DEFAULT_POSITIONS: Record<string, Pos> = {
  detran_uf: { x: 20.0, y: 67.0, fontSize: 8.8 },
  qr: { x: 213.0, y: 114.3, fontSize: 8, w: 140, h: 140 },

  // Coluna esquerda — veículo
  renavam: { x: 19.3, y: 138.6, fontSize: 13.3 },
  placa: { x: 19.3, y: 185.3, fontSize: 13.3 },
  ano_fabricacao: { x: 19.3, y: 236.0, fontSize: 13.3 },
  ano_modelo: { x: 115.0, y: 236.0, fontSize: 13.3 },
  marca_modelo: { x: 19.3, y: 288.0, fontSize: 13.3 },
  cat: { x: 19.3, y: 334.7, fontSize: 13.3 },
  cor: { x: 19.3, y: 381.4, fontSize: 13.3 },
  chassi: { x: 184.7, y: 381.4, fontSize: 13.3 },
  numero_crv: { x: 19.3, y: 434.7, fontSize: 13.3 },
  codigo_seguranca_crv: { x: 184.7, y: 434.7, fontSize: 13.3 },
  numero_atpve: { x: 19.3, y: 488.1, fontSize: 13.3 },
  data_emissao_crv: { x: 184.7, y: 488.1, fontSize: 13.3 },
  hodometro: { x: 19.3, y: 532.1, fontSize: 13.3 },

  // Coluna direita — vendedor
  vend_nome: { x: 426.8, y: 111.9, fontSize: 13.3 },
  vend_cpf: { x: 426.8, y: 161.3, fontSize: 13.3 },
  vend_email: { x: 578.9, y: 157.3, fontSize: 13.3, w: 176 },
  vend_municipio: { x: 426.8, y: 208.0, fontSize: 13.3 },
  vend_uf: { x: 720.3, y: 208.0, fontSize: 13.3 },
  valor_label: { x: 427.8, y: 268.5, fontSize: 9.5 },
  valor_venda: { x: 553.6, y: 266.0, fontSize: 13.3 },
  autorizo: { x: 427.8, y: 291.4, fontSize: 7.7, w: 300 },
  local: { x: 480.0, y: 357.5, fontSize: 11 },
  data_venda: { x: 480.0, y: 393.5, fontSize: 11 },

  // Comprador
  comp_nome: { x: 19.3, y: 613.5, fontSize: 13.3 },
  comp_cpf: { x: 19.3, y: 662.9, fontSize: 13.3 },
  comp_email: { x: 171.4, y: 658.9, fontSize: 13.3, w: 233 },
  comp_municipio: { x: 19.3, y: 712.2, fontSize: 13.3 },
  comp_uf: { x: 311.4, y: 712.2, fontSize: 13.3 },
  comp_endereco: { x: 19.3, y: 757.5, fontSize: 13.3, w: 533 },

  mensagens: { x: 26.7, y: 880.0, fontSize: 10.7, w: 333 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...ATPV_DEFAULT_POSITIONS };
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

/* --------------------------------------------------------------- layout */

/** Larguras máximas dos campos monoespaçados (auto-redução da fonte). */
const FIT_WIDTHS: Record<string, number> = {
  renavam: 165,
  placa: 165,
  ano_fabricacao: 90,
  ano_modelo: 90,
  marca_modelo: 400,
  cat: 400,
  cor: 165,
  chassi: 240,
  numero_crv: 165,
  codigo_seguranca_crv: 240,
  numero_atpve: 165,
  data_emissao_crv: 240,
  hodometro: 400,
  vend_nome: 450,
  vend_cpf: 175,
  vend_municipio: 280,
  vend_uf: 45,
  valor_venda: 170,
  local: 500,
  data_venda: 500,
  comp_nome: 545,
  comp_cpf: 165,
  comp_municipio: 280,
  comp_uf: 90,
};

/** FreeMono Bold é monoespaçada: 0.6em por caractere. */
function fitFontSize(value: string, baseSize: number, maxWidth?: number) {
  if (!maxWidth || !value) return baseSize;
  const width = value.length * 0.6 * baseSize;
  if (width <= maxWidth) return baseSize;
  return Math.max(6, Math.floor((maxWidth / (value.length * 0.6)) * 10) / 10);
}

function buildAtpvHtml(d: Record<string, string>, fieldPositions?: unknown, qrValue?: string) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const mono = (id: string, value: string, extra = "") => {
    const pos = p[id];
    if (!pos || !value) return "";
    const size = fitFontSize(value, pos.fontSize, FIT_WIDTHS[id]);
    return `<div class="overlay mono" style="top:${pos.y}px;left:${pos.x}px;font-size:${size}px;${extra}">${escapeHtml(value)}</div>`;
  };

  /** Texto que pode quebrar em mais de uma linha dentro de uma caixa. */
  const wrap = (id: string, value: string, cls = "mono", extra = "") => {
    const pos = p[id];
    if (!pos || !value) return "";
    return `<div class="overlay ${cls} wrap" style="top:${pos.y}px;left:${pos.x}px;width:${pos.w ?? 200}px;font-size:${pos.fontSize}px;${extra}">${escapeHtml(value)}</div>`;
  };

  const sans = (id: string, value: string, extra = "") => {
    const pos = p[id];
    if (!pos || !value) return "";
    return `<div class="overlay sans" style="top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;${extra}">${escapeHtml(value)}</div>`;
  };

  const qrPos = p.qr;
  const uf = (d.uf || "").toUpperCase();
  const valor = (d.valor_venda || "").trim();

  return `<!DOCTYPE html>
<html>
<head>
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<meta charset="UTF-8">
<style>
  ${ATPV_FONT_FACE}
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
  }
  .page {
    width: 794px;
    height: 1123px;
    position: relative;
    background: #fff;
    overflow: hidden;
  }
  .bg-template { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay {
    position: absolute;
    z-index: 10;
    color: #000;
    font-weight: normal;
    line-height: 1;
    white-space: nowrap;
  }
  .wrap { white-space: normal; word-break: break-word; line-height: 1.15; }
  .mono { font-family: 'AtpvMono', 'Courier New', monospace; }
  .sans { font-family: 'Open Sans', 'Segoe UI', Arial, Helvetica, sans-serif; }
  .qr-overlay {
    background: #fff;
    z-index: 12;
    overflow: hidden;
  }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${qrValue && qrPos ? `<div class="overlay qr-overlay" style="top:${qrPos.y}px;left:${qrPos.x}px;width:${qrPos.w}px;height:${qrPos.h}px;">${qrSvg(qrValue, qrPos.w ?? 140)}</div>` : ""}

  ${sans("detran_uf", uf ? `DETRAN - ${uf}` : "")}

  ${mono("renavam", d.renavam || "")}
  ${mono("placa", (d.placa || "").toUpperCase())}
  ${mono("ano_fabricacao", d.ano_fabricacao || "")}
  ${mono("ano_modelo", d.ano_modelo || "")}
  ${mono("marca_modelo", (d.marca_modelo || "").toUpperCase())}
  ${mono("cat", (d.cat || "").toUpperCase())}
  ${mono("cor", (d.cor || "").toUpperCase())}
  ${mono("chassi", (d.chassi || "").toUpperCase())}
  ${mono("numero_crv", d.numero_crv || "")}
  ${mono("codigo_seguranca_crv", d.codigo_seguranca_crv || "")}
  ${mono("numero_atpve", d.numero_atpve || "")}
  ${mono("data_emissao_crv", d.data_emissao_crv || "")}
  ${mono("hodometro", d.hodometro || "")}

  ${mono("vend_nome", (d.vend_nome || "").toUpperCase())}
  ${mono("vend_cpf", d.vend_cpf || "")}
  ${wrap("vend_email", (d.vend_email || "").toUpperCase())}
  ${mono("vend_municipio", (d.vend_municipio || "").toUpperCase())}
  ${mono("vend_uf", (d.vend_uf || "").toUpperCase())}

  ${valor ? sans("valor_label", "Valor declarado na venda:  R$", "font-weight:bold;") : ""}
  ${mono("valor_venda", valor)}
  ${wrap(
    "autorizo",
    "Autorizo o órgão ou entidade executivo de trânsito dos Estados ou do Distrito Federal, transferir o registro deste veículo para o comprador acima identificado.",
    "sans",
  )}

  ${mono("local", (d.local || "").toUpperCase())}
  ${mono("data_venda", d.data_venda || "")}

  ${mono("comp_nome", (d.comp_nome || "").toUpperCase())}
  ${mono("comp_cpf", d.comp_cpf || "")}
  ${wrap("comp_email", (d.comp_email || "").toUpperCase())}
  ${mono("comp_municipio", (d.comp_municipio || "").toUpperCase())}
  ${mono("comp_uf", (d.comp_uf || "").toUpperCase())}
  ${wrap("comp_endereco", (d.comp_endereco || "").toUpperCase())}

  ${wrap("mensagens", (d.mensagens || "").toUpperCase())}
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

    const fields = [
      "uf", "renavam", "placa", "ano_fabricacao", "ano_modelo", "marca_modelo", "cat",
      "cor", "chassi", "numero_crv", "codigo_seguranca_crv", "numero_atpve",
      "data_emissao_crv", "hodometro",
      "vend_nome", "vend_cpf", "vend_email", "vend_municipio", "vend_uf",
      "valor_venda", "local", "data_venda",
      "comp_nome", "comp_cpf", "comp_email", "comp_municipio", "comp_uf", "comp_endereco",
      "mensagens",
    ];

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const key of fields) data[key] = typeof body[key] === "string" ? body[key] : "";

    // Modo preview: NÃO cadastra no site de validação (QR só funciona no PDF final)
    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? { documentoId: buildDocumentoId(data), qrCodeUrl: "PREVIEW-NAO-VALIDO", registered: false }
      : await registerValidationDocument(data);

    console.log(
      `Validação ATPV: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
    );

    const html = buildAtpvHtml(data, body.field_positions, validacao.qrCodeUrl);

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
  } catch (error: unknown) {
    console.error("Error generating ATPV PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
