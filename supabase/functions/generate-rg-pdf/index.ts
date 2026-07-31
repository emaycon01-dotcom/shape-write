import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { RG_FONT_FACE } from "./rg-font.ts";
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
      name: "rg.pdf",
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

/* ------------------------------------------------------------------ MRZ */

function normalizeMrzText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim();
}

function toMrzToken(value: string) {
  return normalizeMrzText(value).replace(/\s+/g, "<");
}

function toMrzDate(value: string) {
  const br = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy.slice(2)}${mm}${dd}`;
  }
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return `${yyyy.slice(2)}${mm}${dd}`;
  }
  return "<<<<<<";
}

function mrzCharValue(char: string) {
  if (char === "<") return 0;
  if (/\d/.test(char)) return Number(char);
  return char.charCodeAt(0) - 55;
}

function mrzCheckDigit(value: string) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) sum += mrzCharValue(value[i]) * weights[i % 3];
  return String(sum % 10);
}

/**
 * MRZ da CIN (3 linhas de 30 caracteres), no mesmo padrão do documento oficial:
 *   L1: IDBRA + CPF(11) + CPF(11) + "<<" + dígito verificador
 *   L2: nascimento(6) + sexo(1) + validade(6) + BRA + "<"... + dígito verificador
 *   L3: PRIMEIRO<<RESTO<DO<NOME
 */
function buildMrz(d: Record<string, string>) {
  const cpf = (d.cpf || "").replace(/\D/g, "").padEnd(11, "0").slice(0, 11);
  const l1Body = `IDBRA${cpf}${cpf}`;
  const line1 = `${l1Body}<<${mrzCheckDigit(l1Body)}`.padEnd(30, "<").slice(0, 30);

  const birth = toMrzDate(d.data_nascimento || "");
  const expiry = toMrzDate(d.data_validade || "");
  const sex = normalizeMrzText(d.sexo || "").startsWith("F") ? "F" : "M";

  const l2Body = `${birth}${sex}${expiry}BRA`.padEnd(29, "<").slice(0, 29);
  const line2 = `${l2Body}${mrzCheckDigit(`${cpf}${birth}${expiry}`)}`.slice(0, 30);

  const parts = toMrzToken(d.nome_completo || "NOME SOBRENOME").split("<").filter(Boolean);
  const first = parts.shift() || "NOME";
  const rest = parts.join("<");
  const line3 = `${first}<<${rest}`.padEnd(30, "<").slice(0, 30);

  return {
    line1: escapeHtml(line1),
    line2: escapeHtml(line2),
    line3: escapeHtml(line3),
  };
}

/* ------------------------------------------------------------- posições */

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultRgFields
export const RG_DEFAULT_POSITIONS: Record<string, Pos> = {
  // Frente
  photo: { x: 53, y: 199, fontSize: 8, w: 89, h: 101 },
  signature: { x: 170, y: 315, fontSize: 8, w: 80, h: 28 },
  estado: { x: 246, y: 131, fontSize: 14 },
  nome: { x: 155, y: 197, fontSize: 11 },
  nome_social: { x: 155, y: 236, fontSize: 11 },
  registro_geral: { x: 155, y: 261, fontSize: 15 },
  sexo: { x: 298, y: 261, fontSize: 11 },
  data_nascimento: { x: 155, y: 283, fontSize: 11 },
  nacionalidade: { x: 298, y: 283, fontSize: 11 },
  naturalidade: { x: 155, y: 304, fontSize: 11 },
  data_validade: { x: 298, y: 302, fontSize: 11 },
  // Verso
  qr: { x: 50, y: 437, fontSize: 8, w: 82, h: 82 },
  qr2: { x: 504, y: 94, fontSize: 8, w: 240, h: 240 },
  photo2: { x: 397, y: 421, fontSize: 8, w: 36, h: 37 },
  filiacao1: { x: 153, y: 444, fontSize: 11 },
  filiacao2: { x: 153, y: 463, fontSize: 11 },
  orgao_expedidor: { x: 153, y: 481, fontSize: 11 },
  local_emissao: { x: 153, y: 515, fontSize: 11 },
  data_emissao: { x: 325, y: 515, fontSize: 11 },
  mrz: { x: 88, y: 592, fontSize: 17.5 },
  // Outras informações
  titulo_eleitor: { x: 41, y: 743, fontSize: 11 },
  tipo_sanguineo: { x: 297, y: 743, fontSize: 11 },
  estado_civil: { x: 41, y: 770, fontSize: 11 },
  doador: { x: 297, y: 770, fontSize: 11 },
  signature2: { x: 55, y: 805, fontSize: 8, w: 90, h: 33 },
  certidao: { x: 215, y: 806, fontSize: 9 },
  cnh: { x: 41, y: 858, fontSize: 11 },
  categoria: { x: 179, y: 858, fontSize: 11 },
  pis_pasep: { x: 310, y: 858, fontSize: 11 },
  nis: { x: 41, y: 885, fontSize: 11 },
  nit: { x: 179, y: 885, fontSize: 11 },
  ctps: { x: 310, y: 891, fontSize: 11 },
  dni: { x: 41, y: 922, fontSize: 11 },
  cns: { x: 297, y: 922, fontSize: 11 },
  observacao_saude: { x: 41, y: 951, fontSize: 11 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...RG_DEFAULT_POSITIONS };
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

/* ----------------------------------------------------------- acentuação */

const ESTADO_ACENTOS: Record<string, string> = {
  "SAO PAULO": "SÃO PAULO",
  "PARANA": "PARANÁ",
  "MARANHAO": "MARANHÃO",
  "GOIAS": "GOIÁS",
  "PARA": "PARÁ",
  "PIAUI": "PIAUÍ",
  "AMAPA": "AMAPÁ",
  "CEARA": "CEARÁ",
  "ESPIRITO SANTO": "ESPÍRITO SANTO",
  "RONDONIA": "RONDÔNIA",
};

export function estadoAcentuado(value: string): string {
  const v = (value || "").trim().toUpperCase();
  const plain = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ESTADO_ACENTOS[plain] || v;
}

const ESTADO_BOX_W = 220;

/** Auto-ajuste: reduz a fonte para nomes de estado longos, sem sair da caixa. */
function estadoFitStyle(estado: string, baseSize: number) {
  const len = estado.trim().length;
  const maxChars = 12;
  const size = len > maxChars ? Math.max(baseSize * (maxChars / len), baseSize * 0.6) : baseSize;
  return `font-size:${size.toFixed(2)}px;`;
}

/* --------------------------------------------------------------- layout */

function buildRgHtml(d: Record<string, string>, fieldPositions?: unknown, qrValue?: string) {
  const mrz = buildMrz(d);
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
    `<div class="overlay" style="${base(id, extra)}">${escapeHtml(value)}</div>`;

  const clip = (max: number) =>
    `max-width:${max}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;

  const estado = estadoAcentuado(d.estado || "");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${RG_FONT_FACE}
  @page { size: A4 portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'RGDigital', Arial, Helvetica, sans-serif;
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
    font-family: 'RGDigital', Arial, Helvetica, sans-serif;
    color: #111;
    font-weight: normal;
    line-height: 1;
  }
  .photo-overlay { overflow: hidden; }
  .photo-overlay img { width:100%; height:100%; object-fit:cover; image-rendering: high-quality; }
  .qr-overlay {
    background:#fff;
    z-index: 12;
    overflow: hidden;
    outline: 3px solid #fff;
    box-shadow: 0 0 0 3px #fff;
  }
  .qr-overlay svg { width:100%; height:100%; display:block; }
  .sig-overlay { display: flex; align-items: center; justify-content: center; }
  .sig-overlay img { max-width:100%; max-height:100%; object-fit:contain; image-rendering: high-quality; }
  .mrz-line { display:block; text-align:left; white-space:pre; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <!-- FRENTE -->
  <div class="overlay photo-overlay" style="${boxStyle("photo")}">${d.foto ? `<img src="${escapeHtml(d.foto)}" />` : ""}</div>
  <div class="overlay sig-overlay" style="${boxStyle("signature")}">${d.assinatura ? `<img src="${escapeHtml(d.assinatura)}" />` : ""}</div>
  <div class="overlay" style="${base("estado", `width:${ESTADO_BOX_W}px;transform:translateX(-50%);text-align:center;white-space:nowrap;`)}${estadoFitStyle(estado, p.estado.fontSize)}">${escapeHtml(estado)}</div>
  ${text("nome", d.nome_completo || "", clip(330))}
  ${text("nome_social", d.nome_social || "", clip(330))}
  ${text("registro_geral", d.registro_geral || "", clip(180))}
  ${text("sexo", d.sexo || "")}
  ${text("data_nascimento", d.data_nascimento || "")}
  ${text("nacionalidade", d.nacionalidade || "")}
  ${text("naturalidade", d.naturalidade || "", clip(150))}
  ${text("data_validade", d.data_validade || "")}

  <!-- VERSO -->
  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr")}">${qrSvg(qrValue, p.qr.w ?? 82)}</div>` : ""}
  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr2")}">${qrSvg(qrValue, p.qr2?.w ?? 240)}</div>` : ""}
  <div class="overlay photo-overlay" style="${boxStyle("photo2")}">${d.foto ? `<img src="${escapeHtml(d.foto)}" />` : ""}</div>
  ${text("filiacao1", d.filiacao1 || "", clip(300))}
  ${text("filiacao2", d.filiacao2 || "", clip(300))}
  ${text("orgao_expedidor", d.orgao_expedidor || "")}
  ${text("local_emissao", d.local_emissao || "")}
  ${text("data_emissao", d.data_emissao || "")}
  <div class="overlay" style="${base("mrz", "width:420px;line-height:1.22;font-family:'RGOcrb',monospace;letter-spacing:0;")}">
    <div class="mrz-line">${mrz.line1}</div>
    <div class="mrz-line">${mrz.line2}</div>
    <div class="mrz-line">${mrz.line3}</div>
  </div>

  <!-- OUTRAS INFORMAÇÕES -->
  ${text("titulo_eleitor", d.titulo_eleitor || "")}
  ${text("tipo_sanguineo", d.tipo_sanguineo || "")}
  ${text("estado_civil", d.estado_civil || "")}
  ${text("doador", d.doador || "")}
  <div class="overlay sig-overlay" style="${boxStyle("signature2")}">${d.assinatura ? `<img src="${escapeHtml(d.assinatura)}" />` : ""}</div>
  ${text("certidao", d.certidao || "", clip(340))}
  ${text("cnh", d.cnh || "")}
  ${text("categoria", d.categoria || "")}
  ${text("pis_pasep", d.pis_pasep || "")}
  ${text("nis", d.nis || "")}
  ${text("nit", d.nit || "")}
  ${text("ctps", d.ctps || "")}
  ${text("dni", d.dni || "")}
  ${text("cns", d.cns || "")}
  ${text("observacao_saude", d.observacao_saude || "", clip(500))}
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
      nome_completo: body.nome_completo || "",
      nome_social: body.nome_social || "",
      cpf: body.cpf || "",
      registro_geral: body.registro_geral || "",
      sexo: body.sexo || "",
      data_nascimento: body.data_nascimento || "",
      nacionalidade: body.nacionalidade || "",
      naturalidade: body.naturalidade || "",
      data_validade: body.data_validade || "",
      estado: body.estado || "",
      filiacao1: body.filiacao1 || "",
      filiacao2: body.filiacao2 || "",
      orgao_expedidor: body.orgao_expedidor || "",
      local_emissao: body.local_emissao || "",
      data_emissao: body.data_emissao || "",
      titulo_eleitor: body.titulo_eleitor || "",
      tipo_sanguineo: body.tipo_sanguineo || "",
      estado_civil: body.estado_civil || "",
      doador: body.doador || "",
      certidao: body.certidao || "",
      cnh: body.cnh || "",
      categoria: body.categoria || "",
      pis_pasep: body.pis_pasep || "",
      nis: body.nis || "",
      nit: body.nit || "",
      ctps: body.ctps || "",
      dni: body.dni || "",
      cns: body.cns || "",
      observacao_saude: body.observacao_saude || "",
      template_bg: body.template_base64 || "",
    };

    if (body.foto_base64) {
      data.foto = body.foto_base64.startsWith("data:")
        ? body.foto_base64
        : `data:image/png;base64,${body.foto_base64}`;
    }
    if (body.assinatura_base64) {
      data.assinatura = body.assinatura_base64.startsWith("data:")
        ? body.assinatura_base64
        : `data:image/png;base64,${body.assinatura_base64}`;
    }

    // Modo preview: NÃO cadastra no site de validação (QR só funciona no PDF final)
    const isPreview = body.preview === true || body.preview === "true";
    const validacao = isPreview
      ? { documentoId: buildDocumentoId(data), qrCodeUrl: "PREVIEW-NAO-VALIDO", registered: false }
      : await registerValidationDocument(data);

    console.log(
      `Validação RG: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
    );

    // Regra crítica: só imprime o QR Code depois de confirmar o cadastro
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


    const html = buildRgHtml(data, body.field_positions, validacao.qrCodeUrl);

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
    console.error("Error generating RG PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
