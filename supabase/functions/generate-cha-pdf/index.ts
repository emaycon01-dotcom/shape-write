import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { qrSvg, registerValidationDocument, buildDocumentoId } from "./validacao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";
const PDFCO_API_URL = "https://api.pdf.co/v1/pdf/convert/from/html";

async function generateWithPdfShift(html: string, apiKey: string) {
  const pdfRes = await fetch(PDFSHIFT_API_URL, {
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
    throw new Error(`PDFShift error [${pdfRes.status}]: ${errText}`);
  }

  return new Uint8Array(await pdfRes.arrayBuffer());
}

async function generateWithPdfCo(html: string, apiKey: string) {
  const pdfRes = await fetch(PDFCO_API_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      name: "cha.pdf",
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

  const fileRes = await fetch(payload.url);
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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultChaFields
export const CHA_DEFAULT_POSITIONS: Record<string, Pos> = {
  qr: { x: 541, y: 128, fontSize: 8, w: 158, h: 158 },
  photo: { x: 311, y: 209, fontSize: 8, w: 110, h: 116 },
  nome: { x: 79.7, y: 215.5, fontSize: 10.5 },
  nascimento: { x: 88.3, y: 245.8, fontSize: 10.5 },
  cpf: { x: 199.2, y: 245.8, fontSize: 10.5 },
  categoria: { x: 79.7, y: 273.6, fontSize: 10.5 },
  categoria_en: { x: 79.7, y: 284.7, fontSize: 10.5 },
  validade: { x: 88.3, y: 306.7, fontSize: 10.5 },
  inscricao: { x: 199.2, y: 306.7, fontSize: 10.5 },
  foto_data: { x: 349.5, y: 316.9, fontSize: 5 },
  limites: { x: 80.6, y: 419.6, fontSize: 10.5 },
  requisitos: { x: 80.6, y: 459.9, fontSize: 10.5 },
  orgao: { x: 80.6, y: 503.1, fontSize: 10.5 },
  data_emissao: { x: 302.4, y: 503.1, fontSize: 10.5 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...CHA_DEFAULT_POSITIONS };
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

export function buildChaHtml(
  d: Record<string, string>,
  fieldPositions?: unknown,
  qrValue?: string,
) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const base = (id: string, extra = "") => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;${extra}`;
  };

  const boxStyle = (id: string, extra = "") => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;width:${pos.w}px;height:${pos.h}px;${extra}`;
  };

  const text = (id: string, value: string, extra = "") =>
    value ? `<div class="overlay" style="${base(id, extra)}">${escapeHtml(value)}</div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
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
    color: #111;
    font-weight: normal;
    line-height: 1;
    white-space: nowrap;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .photo-box { z-index: 8; overflow: hidden; background: #fff; }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; image-rendering: high-quality; }
  .foto-data {
    z-index: 14;
    background: #fff;
    border: 1px solid #333;
    border-radius: 3px;
    padding: 1px 4px;
    font-weight: bold;
    color: #000;
  }
  .qr-overlay {
    background: #fff;
    z-index: 12;
    overflow: hidden;
    outline: 3px solid #fff;
    box-shadow: 0 0 0 3px #fff;
  }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${d.foto_base64 ? `<div class="overlay photo-box" style="${boxStyle("photo")}"><img src="${escapeHtml(d.foto_base64)}" /></div>` : ""}
  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr")}">${qrSvg(qrValue, p.qr.w ?? 158)}</div>` : ""}

  ${text("nome", (d.nome || "").toUpperCase())}
  ${text("nascimento", d.nascimento || "")}
  ${text("cpf", d.cpf || "")}
  ${text("categoria", (d.categoria || "").toUpperCase())}
  ${text("categoria_en", (d.categoria_en || "").toUpperCase())}
  ${text("validade", d.validade || "")}
  ${text("inscricao", (d.inscricao || "").toUpperCase())}
  ${text("limites", (d.limites || "").toUpperCase())}
  ${text("requisitos", (d.requisitos || "").toUpperCase())}
  ${text("orgao", (d.orgao || "").toUpperCase())}
  ${text("data_emissao", d.data_emissao || "")}

  ${d.foto_data ? `<div class="overlay foto-data" style="${base("foto_data")}">${escapeHtml(d.foto_data)}</div>` : ""}
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

    if (!PDFSHIFT_API_KEY && !PDFCO_API_KEY) {
      throw new Error("No PDF provider API keys are configured");
    }

    const body = await req.json();

    const data: Record<string, string> = {
      nome: body.nome || "",
      cpf: body.cpf || "",
      nascimento: body.nascimento || "",
      categoria: body.categoria || "",
      categoria_en: body.categoria_en || "",
      validade: body.validade || "",
      inscricao: body.inscricao || "",
      limites: body.limites || "",
      requisitos: body.requisitos || "",
      orgao: body.orgao || "MARINHA DO BRASIL",
      data_emissao: body.data_emissao || "",
      foto_data: body.foto_data || "",
      foto_base64: body.foto_base64 || "",
      template_bg: body.template_base64 || "",
    };

    // Modo preview: NÃO cadastra no site de validação (QR só vale no PDF final)
    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? { documentoId: buildDocumentoId(data), qrCodeUrl: "PREVIEW-NAO-VALIDO", registered: false }
      : await registerValidationDocument(data);

    console.log(
      `Validação CHA: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
    );

    const html = buildChaHtml(data, body.field_positions, validacao.qrCodeUrl);

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
    console.error("Error generating CHA PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
