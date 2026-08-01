import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { qrSvg, registerValidationDocument, buildDocumentoId, attachPdf } from "./validacao.ts";

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
      name: "atestado-unimed.pdf",
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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultUnimedFields
export const UNIMED_DEFAULT_POSITIONS: Record<string, Pos> = {
  unidade: { x: 191, y: 18.9, fontSize: 10.3, w: 400 },
  endereco: { x: 191, y: 33.8, fontSize: 8.3, w: 480 },
  lbl_paciente: { x: 18.6, y: 54.8, fontSize: 10.3 },
  lbl_prontuario: { x: 435.1, y: 54.8, fontSize: 10.3 },
  lbl_atendimento: { x: 610.9, y: 54.8, fontSize: 10.3 },
  lbl_nascimento: { x: 18.6, y: 75.4, fontSize: 10.3 },
  lbl_convenio: { x: 425.9, y: 75.4, fontSize: 10.3 },
  lbl_mae: { x: 19.6, y: 96.2, fontSize: 10.3 },
  lbl_setor: { x: 425.9, y: 94, fontSize: 10.3 },
  lbl_leito: { x: 706.1, y: 96.2, fontSize: 10.3 },
  lbl_profissional: { x: 20.7, y: 116.7, fontSize: 10.3 },
  lbl_data_assinatura: { x: 425.9, y: 111.4, fontSize: 10.3 },
  lbl_titulo: { x: 324.7, y: 161.8, fontSize: 12.4 },
  paciente: { x: 138.6, y: 52.7, fontSize: 10.3 },
  prontuario: { x: 516.9, y: 52.6, fontSize: 10.3 },
  atendimento: { x: 688.5, y: 52.7, fontSize: 10.3 },
  nascimento: { x: 138.6, y: 75.4, fontSize: 10.3 },
  idade: { x: 223.3, y: 75.4, fontSize: 10.3 },
  convenio: { x: 516.9, y: 73.2, fontSize: 10.3 },
  mae: { x: 137.8, y: 96.2, fontSize: 10.3 },
  setor: { x: 470, y: 94, fontSize: 10.3 },
  leito: { x: 730, y: 96.2, fontSize: 10.3 },
  data_assinatura: { x: 517.1, y: 111.4, fontSize: 10.3 },
  profissional: { x: 138.6, y: 115, fontSize: 10.3 },
  corpo: { x: 61.3, y: 191, fontSize: 12.4, w: 665 },
  decreto: { x: 58.4, y: 282.6, fontSize: 12.4, w: 655 },
  autorizo: { x: 58.4, y: 327.9, fontSize: 12.4, w: 655 },
  nome_linha: { x: 178.2, y: 463.7, fontSize: 10.3 },
  assinatura_digital: { x: 36.2, y: 775, fontSize: 6.2, w: 420 },
  assinatura_img: { x: 263, y: 470, fontSize: 8, w: 280, h: 100 },
  qr: { x: 568, y: 718, fontSize: 8, w: 72, h: 72 },
  rodape_impresso: { x: 10.3, y: 1095.1, fontSize: 10.3 },
  rodape_criado: { x: 198.1, y: 1095.1, fontSize: 10.3 },
  rodape_crm: { x: 565.4, y: 1095.1, fontSize: 10.3 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...UNIMED_DEFAULT_POSITIONS };
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

/** "11/12/2024" -> "11/12/24" */
function shortYear(v: string): string {
  const m = v.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  return m ? `${m[1]}/${m[2]}/${m[3].slice(-2)}` : v;
}

export function buildCorpoText(d: Record<string, string>): string {
  const doc = d.cpf || d.cns || "";
  const rotulo = d.cpf ? "CPF" : "CNS";
  const hora = (d.hora_atendimento || "").slice(0, 5);
  return (
    `Atesto para os devidos fins, a pedido que o(a) Sr(a). ${d.paciente || ""}, inscrito(a) ` +
    `no ${rotulo} sob o n ${doc}, paciente sob meus cuidado, foi atendido(a) no dia ` +
    `${shortYear(d.data_atendimento || "")} as ${hora} apresentando quadro de ${d.quadro || ""}.`
  );
}

export function buildDecretoText(d: Record<string, string>): string {
  const dias = String(Math.max(1, Number(d.dias || "1") || 1)).padStart(2, "0");
  return (
    `(Este atestado é válido para as finalidades previstas nos artigos 71 e 72, parágrafo 1ª do ` +
    `Decreto 3048/99, e será expedido para justificar o afastamento do trabalho ${dias} dias).`
  );
}

export function buildAutorizoText(d: Record<string, string>): string {
  const cid = (d.cid || "").replace(/^CID[-\s]*/i, "");
  return `Eu, ${d.paciente || ""}, autorizo a inclusão da CID ${cid} no atestado médico.`;
}

/* --------------------------------------------------------------- layout */

export function buildUnimedHtml(
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

  const dataHoraAssinatura = `${d.data_atendimento || ""} ${d.hora_assinatura || d.hora_atendimento || ""}`.trim();
  const dataHoraCurta = `${d.data_atendimento || ""} ${(d.hora_atendimento || "").slice(0, 5)}`.trim();
  const linkValidacao = qrValue && qrValue !== "PREVIEW-NAO-VALIDO"
    ? qrValue
    : "https://www.unimed.coop.br/site/";

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
    font-family: Verdana, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .bg-template { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; }
  .bg-template img { width: 100%; height: 100%; object-fit: fill; image-rendering: high-quality; }
  .overlay { position: absolute; z-index: 10; color: #111; line-height: 1; white-space: nowrap; }
  .txt { white-space: normal; line-height: 1.22; text-align: left; }
  .rule { position: absolute; z-index: 6; background: #111; height: 1px; }
  .qr-overlay { background: #fff; z-index: 12; overflow: hidden; box-shadow: 0 0 0 3px #fff; }
  .qr-overlay svg { width: 100%; height: 100%; display: block; }
  .link { word-break: break-all; white-space: normal; line-height: 1.22; }
  .sig-mask { background: #fff; z-index: 12; }
  .sig { z-index: 13; display: flex; align-items: flex-end; }
  .sig img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  <!-- linhas internas do quadro do cabeçalho -->
  <div class="rule" style="top:69.5px;left:20.5px;width:759px;"></div>
  <div class="rule" style="top:90.2px;left:20.5px;width:759px;"></div>
  <div class="rule" style="top:110.9px;left:20.5px;width:759px;"></div>

  <!-- cabeçalho: unidade -->
  <div class="overlay" style="${base("unidade")}">${escapeHtml(d.unidade || "")}</div>
  <div class="overlay" style="${base("endereco")}">${escapeHtml(d.endereco || "")}</div>

  <!-- rótulos fixos do quadro -->
  <div class="overlay" style="${base("lbl_paciente")}">Nome do paciente:</div>
  <div class="overlay" style="${base("lbl_prontuario")}">Nº Pront.:</div>
  <div class="overlay" style="${base("lbl_atendimento")}">N° Atend.</div>
  <div class="overlay" style="${base("lbl_nascimento")}">Data de Nascimento:</div>
  <div class="overlay" style="${base("lbl_convenio")}">Convênio:</div>
  <div class="overlay" style="${base("lbl_mae")}">Nome da mãe:</div>
  <div class="overlay" style="${base("lbl_setor")}">Setor:</div>
  <div class="overlay" style="${base("lbl_leito")}">Leito:</div>
  <div class="overlay" style="${base("lbl_profissional")}">Profissional:</div>
  <div class="overlay" style="${base("lbl_data_assinatura")}">Data Assinatura:</div>

  <!-- valores do quadro -->
  <div class="overlay" style="${base("paciente")}">${escapeHtml(d.paciente || "")}</div>
  <div class="overlay" style="${base("prontuario")}">${escapeHtml(d.prontuario || "")}</div>
  <div class="overlay" style="${base("atendimento")}">${escapeHtml(d.numero_atendimento || "")}</div>
  <div class="overlay" style="${base("nascimento")}">${escapeHtml(d.nascimento || "")}</div>
  <div class="overlay" style="${base("idade")}">Idade:${escapeHtml(d.idade || "")} Anos</div>
  <div class="overlay" style="${base("convenio")}">${escapeHtml(d.convenio || "")}</div>
  <div class="overlay" style="${base("mae")}">${escapeHtml(d.mae || "")}</div>
  <div class="overlay" style="${base("setor")}">${escapeHtml(d.setor || "")}</div>
  <div class="overlay" style="${base("leito")}">${escapeHtml(d.leito || "")}</div>
  <div class="overlay" style="${base("data_assinatura")}">${escapeHtml(dataHoraAssinatura)}</div>
  <div class="overlay" style="${base("profissional")}">${escapeHtml(d.medico || "")}</div>

  <!-- corpo -->
  <div class="overlay" style="${base("lbl_titulo")}">ATESTADO MÉDICO</div>
  <div class="overlay txt" style="${base("corpo")}">${escapeHtml(buildCorpoText(d))}</div>
  <div class="overlay txt" style="${base("decreto")}">${escapeHtml(buildDecretoText(d))}</div>
  <div class="overlay txt" style="${base("autorizo")}">${escapeHtml(buildAutorizoText(d))}</div>
  <div class="overlay" style="${base("nome_linha")}">${escapeHtml(d.paciente || "")}</div>

  <!-- validação -->
  <div class="overlay" style="top:683.3px;left:214.9px;font-size:10.3px;">A validação do documento poderá ser realizada através do QRCode ou do link abaixo.</div>
  <div class="overlay" style="top:705.7px;left:214.9px;font-size:10.3px;">Caso tenham alguma dúvida ou dificuldade de acesso pedimos fazerem contato no telefone ${escapeHtml(d.telefone || "(21) 2235-6931")}.</div>
  <div class="overlay" style="top:730.8px;left:651.3px;font-size:8.3px;">Aponte a câmera do celular,</div>
  <div class="overlay" style="top:740.9px;left:651.3px;font-size:8.3px;">leitor de QR code ou visite:</div>
  <div class="overlay link" style="top:759.9px;left:649.7px;font-size:8.3px;width:140px;">${escapeHtml(linkValidacao)}</div>

  ${qrValue ? `<div class="overlay qr-overlay" style="${boxStyle("qr")}">${qrSvg(qrValue, p.qr.w ?? 63)}</div>` : ""}

  <!-- assinatura manuscrita (upload, modo manual): cobre a assinatura do template com branco e aplica a nova por cima -->
  ${d.assinatura_base64 ? `<div class="overlay sig-mask" style="${boxStyle("assinatura_img", "")}"></div><div class="overlay sig" style="${boxStyle("assinatura_img")}"><img src="${escapeHtml(d.assinatura_base64)}" /></div>` : ""}

  <!-- assinatura digital ICP -->
  <div class="overlay" style="${base("assinatura_digital", "white-space:nowrap;")}">${escapeHtml(
    `${d.medico || ""}: ${d.crm_numero || ""}, AC CNDL RFB v3, ${d.crm_numero || ""}, ${dataHoraCurta} BRT ${d.data_atendimento || ""}`,
  )}</div>


  <!-- rodapé -->
  <div class="overlay" style="top:1092.5px;left:699.8px;font-size:7.2px;">ANS - Nº ${escapeHtml(d.ans || "34.388-9")}</div>
  <div class="overlay" style="${base("rodape_impresso")}">Impresso em: ${escapeHtml(dataHoraCurta)}</div>
  <div class="overlay" style="${base("rodape_criado")}">Criado por: ${escapeHtml(d.medico || "")}</div>
  <div class="overlay" style="${base("rodape_crm")}">${escapeHtml(d.crm_uf || "CRM-RJ")}: ${escapeHtml(d.crm_numero || "")}</div>
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
      nascimento: body.nascimento || "",
      idade: body.idade || "",
      mae: body.mae || "",
      setor: body.setor || "",
      leito: body.leito || "",
      prontuario: body.prontuario || "",
      numero_atendimento: body.numero_atendimento || "",
      convenio: body.convenio || "UNIMED RJ",
      unidade: body.unidade || "TELESSAUDE - UNIMEDRJ",
      unidade_curta: body.unidade_curta || body.unidade || "TELESSAUDE - UNIMEDRJ",
      endereco: body.endereco || "",
      endereco1: body.endereco || "",
      endereco2: "",
      endereco3: "",
      telefone: body.telefone || "",
      ans: body.ans || "34.388-9",
      data_atendimento: body.data_atendimento || "",
      hora_atendimento: body.hora_atendimento || "",
      hora_assinatura: body.hora_assinatura || "",
      dias: body.dias || "1",
      cid: body.cid || "",
      quadro: body.quadro || "",
      medico: body.medico || "",
      crm_numero: body.crm_numero || "",
      crm_uf: body.crm_uf || "CRM-RJ",
      crm: body.crm || `${body.crm_uf || "CRM-RJ"} ${body.crm_numero || ""}`.trim(),
      especialidade: body.especialidade || "CLÍNICA MÉDICA",
      uf: body.uf || "",
      template_bg: body.template_base64 || "",
      assinatura_base64: typeof body.assinatura_base64 === "string" && body.assinatura_base64.startsWith("data:image/")
        ? body.assinatura_base64
        : "",
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
      `Validação Unimed: preview=${isPreview} id=${validacao.documentoId} registered=${validacao.registered}`,
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

    const html = buildUnimedHtml(data, body.field_positions, validacao.qrCodeUrl);

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

    let pdfUrl: string | null = null;
    if (!isPreview && validacao.token) {
      pdfUrl = await attachPdf(validacao.token, pdfBuffer);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: `data:application/pdf;base64,${bytesToBase64(pdfBuffer)}`,
        documento_id: validacao.documentoId,
        qr_code_url: validacao.qrCodeUrl,
        token: validacao.token ?? null,
        pdf_url: pdfUrl,
        validacao_registrada: validacao.registered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Unimed PDF:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
