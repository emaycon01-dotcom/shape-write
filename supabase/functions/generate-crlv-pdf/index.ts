import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { qrSvg, registerValidationDocument, buildDocumentoId } from "./validacao.ts";
import { CRLV_FONT_FACE } from "./crlv-font.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";
const PDFCO_API_URL = "https://api.pdf.co/v1/pdf/convert/from/html";

async function generateWithPdfShift(html: string, apiKey: string) {
  const pdfRes = await fetch(PDFSHIFT_API_URL, {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      use_print: true,
      format: "A4",
      delay: 120,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    }),
  });

  if (!pdfRes.ok) {
    const errText = await pdfRes.text();
    if (pdfRes.status === 402 || /remaining credits/i.test(errText)) {
      throw new Error("PDFSHIFT_NO_CREDITS");
    }
    throw new Error(`PDFShift error [${pdfRes.status}]: ${errText}`);
  }

  return new Uint8Array(await pdfRes.arrayBuffer());
}

async function generateWithPdfCo(html: string, apiKey: string) {
  const pdfRes = await fetch(PDFCO_API_URL, {
    signal: AbortSignal.timeout(60_000),
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      name: "crlv.pdf",
      async: false,
      margins: "0px 0px 0px 0px",
      paperSize: "A4",
      orientation: "Portrait",
      printBackground: true,
    }),
  });

  const payload = await pdfRes.json().catch(async () => ({
    error: true,
    message: await pdfRes.text().catch(() => "Unknown PDF.co error"),
  }));

  if (!pdfRes.ok || payload?.error || !payload?.url) {
    throw new Error(
      `PDF.co error [${pdfRes.status}]: ${payload?.message || payload?.error || "Failed to create PDF"}`,
    );
  }

  const fileRes = await fetch(payload.url, { signal: AbortSignal.timeout(45_000) });
  if (!fileRes.ok) {
    const errText = await fileRes.text();
    throw new Error(`PDF.co file download error [${fileRes.status}]: ${errText}`);
  }

  return new Uint8Array(await fileRes.arrayBuffer());
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultCrlvFields
export const CRLV_DEFAULT_POSITIONS: Record<string, Pos> = {
  // Cabeçalho
  detran_uf: { x: 41.3, y: 72.6, fontSize: 5.9 },
  titulo: { x: 41.3, y: 86.3, fontSize: 8.5 },
  // QR Code de validação
  qr: { x: 214.7, y: 115.6, fontSize: 8, w: 146, h: 146 },
  // Coluna esquerda
  renavam: { x: 41.5, y: 134.6, fontSize: 13.3 },
  placa: { x: 41.5, y: 169.5, fontSize: 13.3 },
  exercicio: { x: 136.9, y: 169.5, fontSize: 13.3 },
  ano_fabricacao: { x: 41.5, y: 204.6, fontSize: 13.3 },
  ano_modelo: { x: 136.9, y: 204.6, fontSize: 13.3 },
  numero_crv: { x: 41.5, y: 239.6, fontSize: 13.3 },
  codigo_cla: { x: 41.5, y: 343.1, fontSize: 13.3 },
  cat: { x: 216.5, y: 343.1, fontSize: 13.3 },
  marca_modelo: { x: 41.5, y: 390.1, fontSize: 13.3 },
  especie_tipo: { x: 41.5, y: 437.1, fontSize: 13.3 },
  placa_anterior: { x: 41.5, y: 484.2, fontSize: 13.3 },
  chassi: { x: 174.2, y: 484.2, fontSize: 13.3 },
  cor: { x: 41.5, y: 531.1, fontSize: 13.3 },
  combustivel: { x: 136.9, y: 531.1, fontSize: 13.3 },
  observacoes: { x: 37.5, y: 590.0, fontSize: 13.3 },
  // Coluna direita
  categoria: { x: 421.8, y: 96.3, fontSize: 13.3 },
  capacidade: { x: 679.9, y: 116.0, fontSize: 13.3 },
  potencia: { x: 421.8, y: 151.0, fontSize: 13.3 },
  peso_bruto: { x: 679.9, y: 151.0, fontSize: 13.3 },
  motor: { x: 421.8, y: 186.1, fontSize: 13.3 },
  cmt: { x: 604.9, y: 186.1, fontSize: 13.3 },
  eixos: { x: 672.8, y: 186.1, fontSize: 13.3 },
  lotacao: { x: 718.1, y: 186.1, fontSize: 13.3 },
  carroceria: { x: 421.8, y: 221.0, fontSize: 13.3 },
  nome: { x: 421.8, y: 253.8, fontSize: 13.3 },
  cpf_cnpj: { x: 617.4, y: 296.1, fontSize: 13.3 },
  local: { x: 421.8, y: 343.1, fontSize: 13.3 },
  data: { x: 679.9, y: 343.1, fontSize: 13.3 },
  // Seguro DPVAT
  cat_tarif: { x: 421.8, y: 428.4, fontSize: 13.3 },
  data_quitacao: { x: 518.9, y: 428.4, fontSize: 13.3 },
  repasse_fns: { x: 421.8, y: 478.7, fontSize: 13.3 },
  custo_bilhete: { x: 564.9, y: 478.7, fontSize: 13.3 },
  custo_efetivo: { x: 659.3, y: 478.7, fontSize: 13.3 },
  repasse_denatran: { x: 421.8, y: 533.0, fontSize: 13.3 },
  valor_iof: { x: 564.9, y: 533.0, fontSize: 13.3 },
  valor_total: { x: 659.3, y: 533.0, fontSize: 13.3 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...CRLV_DEFAULT_POSITIONS };
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

/** Campos monoespaçados que aceitam auto-redução quando o texto é longo. */
const FIT_WIDTHS: Record<string, number> = {
  renavam: 170,
  placa: 90,
  exercicio: 90,
  ano_fabricacao: 90,
  ano_modelo: 90,
  numero_crv: 170,
  codigo_cla: 170,
  cat: 170,
  marca_modelo: 350,
  especie_tipo: 350,
  placa_anterior: 128,
  chassi: 215,
  cor: 90,
  combustivel: 240,
  observacoes: 330,
  categoria: 250,
  capacidade: 105,
  potencia: 250,
  peso_bruto: 105,
  motor: 180,
  cmt: 62,
  eixos: 40,
  lotacao: 60,
  carroceria: 355,
  nome: 355,
  cpf_cnpj: 160,
  local: 250,
  data: 105,
};

/** FreeMono Bold é monoespaçada: 0.6em por caractere. */
function fitFontSize(value: string, baseSize: number, maxWidth?: number) {
  if (!maxWidth || !value) return baseSize;
  const width = value.length * 0.6 * baseSize;
  if (width <= maxWidth) return baseSize;
  return Math.max(6, Math.floor((maxWidth / (value.length * 0.6)) * 10) / 10);
}

function buildCrlvHtml(d: Record<string, string>, fieldPositions?: unknown, qrValue?: string) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const mono = (id: string, value: string, extra = "") => {
    const pos = p[id];
    if (!pos) return "";
    const size = fitFontSize(value, pos.fontSize, FIT_WIDTHS[id]);
    return `<div class="overlay mono" style="top:${pos.y}px;left:${pos.x}px;font-size:${size}px;${extra}">${escapeHtml(value)}</div>`;
  };

  const sans = (id: string, value: string, extra = "") => {
    const pos = p[id];
    if (!pos) return "";
    return `<div class="overlay sans" style="top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;${extra}">${escapeHtml(value)}</div>`;
  };

  /** Campo monoespaçado com quebra de linha manual dentro da largura do quadro. */
  const monoWrap = (id: string, value: string, extra = "") => {
    const pos = p[id];
    if (!pos) return "";
    const maxWidth = pos.w ?? FIT_WIDTHS[id] ?? 480;
    const size = pos.fontSize;
    const perLine = Math.max(10, Math.floor(maxWidth / (0.6 * size)));
    const words = (value || "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
      } else if ((current + " " + word).length <= perLine) {
        current += " " + word;
      } else {
        lines.push(current);
        current = word;
      }
      while (current.length > perLine) {
        lines.push(current.slice(0, perLine));
        current = current.slice(perLine);
      }
    }
    if (current) lines.push(current);
    if (!lines.length) return "";
    const html = lines
      .map(
        (ln, i) =>
          `<div class="overlay mono" style="top:${pos.y + i * size * 1.45}px;left:${pos.x}px;font-size:${size}px;${extra}">${escapeHtml(ln)}</div>`,
      )
      .join("\n");
    return html;
  };



  const qrPos = p.qr;
  const uf = (d.uf || "").toUpperCase();

  return `<!DOCTYPE html>
<html>
<head>
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<style>a,a:link,a:visited{color:inherit !important;text-decoration:none !important;-webkit-text-fill-color:inherit !important;}</style>
<meta charset="UTF-8">
<style>
  ${CRLV_FONT_FACE}
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
  .mono { font-family: 'CrlvMono', 'Courier New', monospace; }
  .sans { font-family: 'Open Sans', 'Segoe UI', Arial, Helvetica, sans-serif; }
  .bold { font-weight: bold; }
  .qr-overlay {
    background: #fff;
    z-index: 12;
    overflow: hidden;
    outline: 4px solid #fff;
    box-shadow: 0 0 0 4px #fff;
  }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${qrValue && qrPos ? `<div class="overlay qr-overlay" style="top:${qrPos.y}px;left:${qrPos.x}px;width:${qrPos.w}px;height:${qrPos.h}px;">${qrSvg(qrValue, qrPos.w ?? 146)}</div>` : ""}

  ${sans("detran_uf", uf ? `DETRAN- ${uf}` : "")}
  ${sans("titulo", "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO - DIGITAL", "font-weight:bold;")}

  ${mono("renavam", d.renavam || "")}
  ${mono("placa", (d.placa || "").toUpperCase())}
  ${mono("exercicio", d.exercicio || "")}
  ${mono("ano_fabricacao", d.ano_fabricacao || "")}
  ${mono("ano_modelo", d.ano_modelo || "")}
  ${mono("numero_crv", d.numero_crv || "")}
  ${mono("codigo_cla", d.codigo_cla || "")}
  ${mono("cat", d.cat || "")}
  ${mono("marca_modelo", (d.marca_modelo || "").toUpperCase())}
  ${mono("especie_tipo", (d.especie_tipo || "").toUpperCase())}
  ${mono("placa_anterior", (d.placa_anterior || "").toUpperCase())}
  ${mono("chassi", (d.chassi || "").toUpperCase())}
  ${mono("cor", (d.cor || "").toUpperCase())}
  ${mono("combustivel", (d.combustivel || "").toUpperCase())}
  ${monoWrap("observacoes", (d.observacoes || "").toUpperCase())}

  ${mono("categoria", (d.categoria || "").toUpperCase())}
  ${mono("capacidade", d.capacidade || "")}
  ${mono("potencia", (d.potencia || "").toUpperCase())}
  ${mono("peso_bruto", d.peso_bruto || "")}
  ${mono("motor", (d.motor || "").toUpperCase())}
  ${mono("cmt", d.cmt || "")}
  ${mono("eixos", d.eixos || "")}
  ${mono("lotacao", (d.lotacao || "").toUpperCase())}
  ${mono("carroceria", (d.carroceria || "").toUpperCase())}
  ${mono("nome", (d.nome || "").toUpperCase())}
  ${mono("cpf_cnpj", d.cpf_cnpj || "")}
  ${mono("local", (d.local || "").toUpperCase())}
  ${mono("data", d.data || "")}

  ${mono("cat_tarif", d.cat_tarif || "*")}
  ${mono("data_quitacao", d.data_quitacao || "*")}
  ${mono("repasse_fns", d.repasse_fns || "*")}
  ${mono("custo_bilhete", d.custo_bilhete || "*")}
  ${mono("custo_efetivo", d.custo_efetivo || "*")}
  ${mono("repasse_denatran", d.repasse_denatran || "*")}
  ${mono("valor_iof", d.valor_iof || "*")}
  ${mono("valor_total", d.valor_total || "*")}
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
    const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");
    const PDFCO_API_KEY = Deno.env.get("PDFCO_API_KEY");

    const body = await req.json();

    const fields = [
      "uf", "renavam", "placa", "exercicio", "ano_fabricacao", "ano_modelo", "numero_crv",
      "codigo_cla", "cat", "marca_modelo", "especie_tipo", "placa_anterior", "chassi",
      "cor", "combustivel", "observacoes", "categoria", "capacidade", "potencia",
      "peso_bruto", "motor", "cmt", "eixos", "lotacao", "carroceria", "nome", "cpf_cnpj",
      "local", "data", "cat_tarif", "data_quitacao", "repasse_fns", "custo_bilhete",
      "custo_efetivo", "repasse_denatran", "valor_iof", "valor_total",
    ];

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const key of fields) data[key] = typeof body[key] === "string" ? body[key] : "";

    // Modo preview: NÃO cadastra no site de validação (QR só funciona no PDF final)
    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? { documentoId: buildDocumentoId(data), qrCodeUrl: "PREVIEW-NAO-VALIDO", registered: false }
      : await registerValidationDocument(data);

    console.log(
      `Validação CRLV: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
    );

    if (!isPreview && !validacao.registered) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falha ao registrar o documento na validação. Tente novamente.",
          detail: validacao.error ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = buildCrlvHtml(data, body.field_positions, validacao.qrCodeUrl);

    // Renderizacao no proprio navegador (sem servico externo de PDF).
    if ((body as any).render === "html") {
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
    }
    let pdfBuffer: Uint8Array | null = null;

    if (PDFSHIFT_API_KEY) {
      try {
        pdfBuffer = await generateWithPdfShift(html, PDFSHIFT_API_KEY);
      } catch (error) {
        console.warn("PDFShift failed, attempting PDF.co fallback...", error);
        if (!PDFCO_API_KEY) throw error;
      }
    }

    if (!pdfBuffer) {
      if (!PDFCO_API_KEY) {
        throw new Error("PDF generation failed and PDF.co fallback is not configured");
      }
      pdfBuffer = await generateWithPdfCo(html, PDFCO_API_KEY);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: `data:application/pdf;base64,${bytesToBase64(pdfBuffer)}`,
        documento_id: validacao.documentoId,
        qr_code_url: validacao.qrCodeUrl,
        validacao_registrada: validacao.registered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating CRLV PDF:", error);
    let msg = error instanceof Error ? error.message : "Unknown error";
    if (/PDFSHIFT_NO_CREDITS|remaining credits/i.test(msg)) {
      msg = "O servico de geracao de PDF esta sem creditos. Avise o administrador para recarregar.";
    } else if (/TimeoutError|timed out|aborted/i.test(msg)) {
      msg = "A geracao demorou demais e foi cancelada. Tente novamente em instantes.";
    }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
