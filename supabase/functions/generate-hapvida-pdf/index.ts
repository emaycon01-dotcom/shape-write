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
      name: "atestado-hapvida.pdf",
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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultHapvidaFields
export const HAPVIDA_DEFAULT_POSITIONS: Record<string, Pos> = {
  endereco1: { x: 344, y: 32, fontSize: 13.4, w: 400 },
  endereco2: { x: 344, y: 53.6, fontSize: 13.4, w: 400 },
  consulte: { x: 486, y: 138, fontSize: 10.4, w: 260 },
  link: { x: 486, y: 151.4, fontSize: 10.4, w: 260 },
  qr: { x: 658, y: 172, fontSize: 8, w: 87, h: 87 },
  paciente: { x: 42.2, y: 151, fontSize: 12.4 },
  cpf: { x: 42.2, y: 174, fontSize: 12.4 },
  celular: { x: 42.2, y: 194, fontSize: 12.4 },
  tipo_atendimento: { x: 42.2, y: 215.8, fontSize: 12.4 },
  corpo: { x: 42.2, y: 389.8, fontSize: 14.6, w: 700 },
  data_emissao: { x: 42.2, y: 847.3, fontSize: 14.6 },
  medico: { x: 42.2, y: 942.1, fontSize: 12.4 },
  crm: { x: 42.2, y: 963.1, fontSize: 12.4 },
  assinatura: { x: 400, y: 933, fontSize: 9.6, w: 92 },
  assinatura_info: { x: 625, y: 935.5, fontSize: 9.1, w: 150 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...HAPVIDA_DEFAULT_POSITIONS };
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

/* --------------------------------------------------------------- corpo */

const b = (v: string) => `<b>${escapeHtml(v)}</b>`;

export function buildCorpoHtml(d: Record<string, string>): string {
  const dias = Math.max(1, Number(d.dias || "1") || 1);
  const doc = d.cpf || d.cns || "";
  const cid = (d.cid || "").replace(/^CID[-\s]*/i, "");
  const dataHora = `${d.data_atendimento || ""} ${(d.hora_atendimento || "").slice(0, 5)}`.trim();

  const p1 =
    `Atesto, para os devidos fins, que ${b(d.paciente || "")}, portador do CPF/CNS ` +
    `nº ${b(doc)}, foi submetido a uma consulta médica na data de hoje, ${b(dataHora)} hrs, ` +
    `sendo diagnosticado como portador da afecção ${escapeHtml(`CID-${cid}`)}.`;

  const p2 =
    `Em decorrência, deverá permanecer afastado de suas atividades laborativas por um período de ` +
    `${b(String(dias))} dia(s), a partir desta data.`;

  const p3 = `Atestado válido a partir de ${b(d.data_atendimento || "")}.`;

  return [p1, p2, p3].map((p) => `<p>${p}</p>`).join("");
}

/* --------------------------------------------------------------- layout */

export function buildHapvidaHtml(
  d: Record<string, string>,
  fieldPositions?: unknown,
  qrValue?: string,
) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const base = (id: string, extra = "") => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;font-size:${pos.fontSize}px;${
      pos.w ? `width:${pos.w}px;` : ""
    }${extra}`;
  };

  const boxStyle = (id: string, extra = "") => {
    const pos = p[id];
    return `top:${pos.y}px;left:${pos.x}px;width:${pos.w}px;height:${pos.h}px;${extra}`;
  };

  const linkText = d.link_prescricao || (qrValue && qrValue !== "PREVIEW-NAO-VALIDO" ? qrValue : "");

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
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
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
    color: #1a1a1a;
    font-weight: normal;
    line-height: 1;
    white-space: nowrap;
  }
  .right { text-align: right; }
  .muted { color: #6b6b6b; }
  .bold { font-weight: bold; }
  .corpo { white-space: normal; line-height: 1.72; text-align: left; color: #1a1a1a; }
  .corpo p { margin: 0 0 18px 0; }
  .assin { white-space: normal; line-height: 1.2; }
  .qr-overlay {
    background: #fff;
    z-index: 12;
    overflow: hidden;
    outline: 4px solid #fff;
    box-shadow: 0 0 0 4px #fff;
  }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
  .lbl { font-weight: bold; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <div class="overlay right muted" style="${base("endereco1")}">${escapeHtml(d.endereco1 || "")}</div>
  <div class="overlay right muted" style="${base("endereco2")}">${escapeHtml(d.endereco2 || "")}</div>

  <div class="overlay right muted" style="${base("consulte")}">Consulte a prescrição acessando</div>
  ${linkText
      ? `<div class="overlay right muted" style="${base("link", "overflow:hidden;text-overflow:ellipsis;")}"><span style="text-decoration:underline;">${escapeHtml(linkText)}</span> ou</div>`
      : ""}

  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr")}">${qrSvg(qrValue, p.qr.w ?? 87)}</div>` : ""}

  <div class="overlay bold" style="${base("paciente")}">${escapeHtml(d.paciente || "")}</div>
  <div class="overlay" style="${base("cpf")}"><span class="lbl">CPF:</span> ${escapeHtml(d.cpf || d.cns || "")}</div>
  <div class="overlay" style="${base("celular")}"><span class="lbl">Celular:</span> ${escapeHtml(d.celular || "")}</div>
  <div class="overlay" style="${base("tipo_atendimento")}"><span class="lbl">Tipo de atendimento:</span> &nbsp;${escapeHtml(d.tipo_atendimento || "")}</div>

  <div class="overlay corpo" style="${base("corpo")}">${buildCorpoHtml(d)}</div>

  <div class="overlay" style="${base("data_emissao")}">Data de emissão: ${escapeHtml(d.data_emissao || d.data_atendimento || "")}</div>

  <div class="overlay bold" style="${base("medico")}">${escapeHtml(d.medico || "")}</div>
  <div class="overlay muted" style="${base("crm")}">${escapeHtml(d.crm || "")} - &nbsp;${escapeHtml(d.especialidade || "")}</div>

  <div class="overlay bold assin" style="${base("assinatura")}">${escapeHtml(d.medico || "")}</div>
  <div class="overlay assin muted" style="${base("assinatura_info")}">Digitally signed by<br/>${escapeHtml(d.medico || "")}</div>
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
      celular: body.celular || "",
      tipo_atendimento: body.tipo_atendimento || "Urgência",
      unidade: body.unidade || "Hapvida NotreDame Intermédica",
      unidade_curta: body.unidade_curta || "Hapvida NotreDame Intermédica",
      endereco1: body.endereco1 || "",
      endereco2: body.endereco2 || "",
      endereco3: body.endereco3 || "",
      data_atendimento: body.data_atendimento || "",
      hora_atendimento: body.hora_atendimento || "",
      dias: body.dias || "1",
      cid: body.cid || "",
      data_emissao: body.data_emissao || "",
      emitido_em: body.emitido_em || "",
      liberado_hora: body.liberado_hora || "",
      medico: body.medico || "",
      crm: body.crm || "",
      especialidade: body.especialidade || "",
      nascimento: body.nascimento || "",
      uf: body.uf || "",
      link_prescricao: body.link_prescricao || "",
      template_bg: body.template_base64 || "",
    };

    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? {
          documentoId: buildDocumentoId(data),
          qrCodeUrl: "PREVIEW-NAO-VALIDO",
          token: undefined as string | undefined,
          registered: false,
        }
      : await registerValidationDocument(data);

    console.log(
      `Validação HapVida: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
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

    // QR Code do site público de validação (código opaco gerado pelo cliente).
    const VERIFY_BASE = "https://api-hapvida.xyz/verify/";
    const verifyCode = typeof body.verify_code === "string" &&
      /^[A-Za-z0-9_-]{8,128}$/.test(body.verify_code)
      ? body.verify_code
      : "";
    const qrValue = !isPreview && verifyCode
      ? `${VERIFY_BASE}${verifyCode}`
      : validacao.qrCodeUrl;

    const html = buildHapvidaHtml(data, body.field_positions, qrValue);


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
        token: validacao.token ?? null,
        validacao_registrada: validacao.registered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating HapVida PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
