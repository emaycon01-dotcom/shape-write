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
      name: "atestado.pdf",
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

/* -------------------------------------------------------------- extenso */

const EXTENSO: string[] = [
  "Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez",
  "Onze", "Doze", "Treze", "Quatorze", "Quinze", "Dezesseis", "Dezessete", "Dezoito",
  "Dezenove", "Vinte", "Vinte e um", "Vinte e dois", "Vinte e três", "Vinte e quatro",
  "Vinte e cinco", "Vinte e seis", "Vinte e sete", "Vinte e oito", "Vinte e nove", "Trinta",
];

export function numeroPorExtenso(n: number): string {
  return EXTENSO[n] || String(n);
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "08/11/2023" -> "08 de Novembro de 2023" */
export function dataPorExtenso(v: string): string {
  const m = (v || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return v || "";
  const [, dd, mm, yyyy] = m;
  return `${dd} de ${MESES[Number(mm) - 1] || mm} de ${yyyy}`;
}

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultAtestadoFields
export const ATESTADO_DEFAULT_POSITIONS: Record<string, Pos> = {
  qr: { x: 630, y: 30, fontSize: 8, w: 134, h: 134 },
  endereco1: { x: 386, y: 100, fontSize: 14.7 },
  endereco2: { x: 386, y: 114.5, fontSize: 14.7 },
  endereco3: { x: 386, y: 128, fontSize: 14.7 },
  paciente: { x: 118, y: 265.5, fontSize: 20 },
  corpo: { x: 18, y: 337.5, fontSize: 20 },
  cid: { x: 17, y: 423, fontSize: 24 },
  cidade_data: { x: 364, y: 564.5, fontSize: 20 },
  emitido_em: { x: 39, y: 898, fontSize: 10.2 },
  liberado: { x: 398, y: 902, fontSize: 12.75 },
  qr2: { x: 400, y: 955, fontSize: 8, w: 95, h: 95 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...ATESTADO_DEFAULT_POSITIONS };
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

export function buildCorpoTexto(d: Record<string, string>): string {
  if (d.corpo && d.corpo.trim()) return d.corpo.trim();

  const dias = Number(d.dias || "1") || 1;
  const ext = numeroPorExtenso(dias);
  const plural = dias > 1 ? "dias" : "dia";
  const cns = d.cns ? `, CNS: ${d.cns}` : "";

  return `Atesto para os devidos fins, que o(a), ${d.paciente || ""}${cns} ` +
    `foi atendido(a) no(a), ${d.unidade || ""} na data ${d.data_atendimento || ""} ` +
    `ás ${d.hora_atendimento || ""}, necessitando de ${dias} (${ext}) ${plural} de repouso ` +
    `por motivo de ${d.motivo || "doença"}.`;
}

function buildAtestadoHtml(d: Record<string, string>, fieldPositions?: unknown, qrValue?: string) {
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

  const text = (id: string, value: string, cls = "", extra = "") =>
    `<div class="overlay ${cls}" style="${base(id, extra)}">${escapeHtml(value)}</div>`;

  const corpo = buildCorpoTexto(d);
  const cidadeData = d.cidade_data ||
    `${d.unidade_curta || d.unidade || ""}, ${dataPorExtenso(d.data_emissao || d.data_atendimento || "")}`;

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
    color: #000;
    font-weight: normal;
    line-height: 1;
  }
  .calibri { font-family: Calibri, Carlito, 'Segoe UI', Arial, Helvetica, sans-serif; }
  .arial { font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; }
  .times { font-family: 'Times New Roman', 'Liberation Serif', Times, serif; }
  .bold { font-weight: bold; }
  .qr-overlay {
    background: #fff;
    z-index: 12;
    overflow: hidden;
    outline: 3px solid #fff;
    box-shadow: 0 0 0 3px #fff;
  }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
  .para-label { font-size: 0.72em; letter-spacing: 0.3px; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr")}">${qrSvg(qrValue, p.qr.w ?? 134)}</div>` : ""}
  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr2")}">${qrSvg(qrValue, p.qr2?.w ?? 95)}</div>` : ""}

  ${text("endereco1", d.endereco1 || "", "calibri bold")}
  ${text("endereco2", d.endereco2 || "", "calibri bold")}
  ${text("endereco3", d.endereco3 || "", "calibri bold")}

  <div class="overlay arial" style="${base("paciente", "white-space:nowrap;")}"><span class="para-label">PARA:</span> ${escapeHtml(d.paciente || "")}</div>

  <div class="overlay times" style="${base("corpo", "width:762px;line-height:1.43;text-align:left;")}">${escapeHtml(corpo)}</div>

  ${text("cid", d.cid ? `CID: ${d.cid}` : "", "times")}

  <div class="overlay arial" style="${base("cidade_data", "white-space:nowrap;")}">${escapeHtml(cidadeData)}</div>

  <div class="overlay calibri bold" style="${base("emitido_em", "white-space:nowrap;")}">Emitido em: ${escapeHtml(d.emitido_em || "")}</div>

  <div class="overlay calibri bold" style="${base("liberado", "width:232px;text-align:center;line-height:1.32;")}">
    Liberado e assinado<br/>eletronicamente em ${escapeHtml(d.liberado_data || "")}<br/>${escapeHtml(d.liberado_hora || "")} por:
  </div>
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
      paciente: body.paciente || "",
      cpf: body.cpf || "",
      cns: body.cns || "",
      unidade: body.unidade || "",
      unidade_curta: body.unidade_curta || "",
      endereco1: body.endereco1 || "",
      endereco2: body.endereco2 || "",
      endereco3: body.endereco3 || "",
      data_atendimento: body.data_atendimento || "",
      hora_atendimento: body.hora_atendimento || "",
      dias: body.dias || "1",
      motivo: body.motivo || "doença",
      cid: body.cid || "",
      corpo: body.corpo || "",
      cidade_data: body.cidade_data || "",
      data_emissao: body.data_emissao || "",
      emitido_em: body.emitido_em || "",
      liberado_data: body.liberado_data || "",
      liberado_hora: body.liberado_hora || "",
      medico: body.medico || "",
      crm: body.crm || "",
      template_bg: body.template_base64 || "",
    };

    // Modo preview: NÃO cadastra no site de validação (QR só funciona no PDF final)
    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? { documentoId: buildDocumentoId(data), qrCodeUrl: "PREVIEW-NAO-VALIDO", registered: false }
      : await registerValidationDocument(data);

    console.log(
      `Validação Atestado: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
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

    const html = buildAtestadoHtml(data, body.field_positions, validacao.qrCodeUrl);

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
    console.error("Error generating Atestado PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
