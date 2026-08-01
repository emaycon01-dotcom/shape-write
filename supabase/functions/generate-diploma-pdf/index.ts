import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  qrSvg,
  
  buildDocumentoId,
  buildValidationUrl,
  registerDiplomaPortal,
  toIsoDate,
  maskCpf,
  maskCnpj,
  flexTitulo,
} from "./validacao.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PDFSHIFT_API_URL = "https://api.pdfshift.io/v3/convert/pdf";
const PDFCO_API_URL = "https://api.pdf.co/v1/pdf/convert/from/html";

/* -------------------------------------------------------------- provedores */

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
      landscape: true,
      use_print: true,
      format: "A4",
      delay: 150,
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
      name: "diploma.pdf",
      async: false,
      margins: "0px 0px 0px 0px",
      paperSize: "A4",
      orientation: "Landscape",
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
  if (!fileRes.ok) throw new Error(`PDF.co download error [${fileRes.status}]`);
  return new Uint8Array(await fileRes.arrayBuffer());
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/* ------------------------------------------------------------- geometria */

// Espaço de coordenadas do editor: 1288 x 866 por página.
// A página 2 usa y a partir de 866 (o gerador subtrai o offset).
export const PAGE_W = 1288;
export const PAGE_H = 866;
// A4 paisagem = 1123 x 794 px. O template é encaixado preservando a proporção.
const SHEET_W = 1123;
const SHEET_H = 794;
const SCALE = SHEET_W / PAGE_W; // 0.871894
const OFFSET_TOP = (SHEET_H - PAGE_H * SCALE) / 2;

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultDiplomaFields
export const DIPLOMA_DEFAULT_POSITIONS: Record<string, Pos> = {
  // ---------- página 1 ----------
  rep_federativa: { x: 644, y: 136.7, fontSize: 13.5 },
  ministerio: { x: 644, y: 152.4, fontSize: 13.5 },
  inst_l1: { x: 644, y: 174, fontSize: 31 },
  inst_l2: { x: 644, y: 213, fontSize: 31 },
  corpo: { x: 644, y: 283, fontSize: 15.5 },
  cidade_data: { x: 721, y: 555, fontSize: 15.5 },
  reitor: { x: 1032, y: 663, fontSize: 12.5 },
  rodape_inst: { x: 644, y: 751, fontSize: 13 },
  rodape_validacao: { x: 644, y: 767, fontSize: 11.5 },
  // ---------- página 2 (y + 866) ----------
  p2_esq_nome: { x: 30.4, y: 927.8, fontSize: 11.5 },
  p2_esq_razao: { x: 30.4, y: 954.4, fontSize: 11.5 },
  p2_esq_cred: { x: 30.4, y: 997.8, fontSize: 11.5 },
  p2_esq_recred: { x: 30.4, y: 1040.7, fontSize: 11.5 },
  p2_curso: { x: 30.4, y: 1099.2, fontSize: 11.5 },
  p2_reconhecimento: { x: 30.4, y: 1120.4, fontSize: 11.5 },
  p2_renovacao: { x: 30.4, y: 1159, fontSize: 11.5 },
  p2_dir_recred: { x: 671.4, y: 1063.3, fontSize: 11.5 },
  p2_registro: { x: 671.4, y: 1121.6, fontSize: 11.5 },
  p2_processo: { x: 671.4, y: 1189.6, fontSize: 11.5 },
  p2_cidade_data: { x: 671.4, y: 1230.1, fontSize: 11.5 },
  secretario: { x: 958, y: 1309, fontSize: 11.5 },
  resolucao: { x: 958, y: 1343, fontSize: 11 },
  qr: { x: 1032, y: 1515, fontSize: 8, w: 110, h: 110 },
  serial: { x: 1144, y: 1636, fontSize: 11 },
};

interface StyleDef {
  center?: boolean;
  width?: number;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  /** cobre o texto impresso no template com um retângulo branco */
  mask?: { w: number; h: number };
  align?: "left" | "center";
}

const STYLES: Record<string, StyleDef> = {
  rep_federativa: { center: true, width: 700 },
  ministerio: { center: true, width: 700 },
  inst_l1: { center: true, width: 1000 },
  inst_l2: { center: true, width: 1000 },
  corpo: { center: true, width: 1030, lineHeight: 37.7 },
  cidade_data: { width: 440, lineHeight: 20 },
  reitor: { center: true, mask: { w: 320, h: 17 }, italic: true, align: "center" },
  rodape_inst: { center: true, width: 700 },
  rodape_validacao: { center: true, width: 900 },
  p2_esq_nome: { bold: true, width: 620, lineHeight: 17 },
  p2_esq_razao: { width: 620, lineHeight: 17 },
  p2_esq_cred: { width: 600, lineHeight: 17 },
  p2_esq_recred: { width: 600, lineHeight: 17 },
  p2_curso: { bold: true, width: 620, lineHeight: 17 },
  p2_reconhecimento: { width: 600, lineHeight: 17 },
  p2_renovacao: { width: 600, lineHeight: 17 },
  p2_dir_recred: { width: 580, lineHeight: 17 },
  p2_registro: { width: 580, lineHeight: 17 },
  p2_processo: { width: 580, lineHeight: 17 },
  p2_cidade_data: { width: 580, lineHeight: 17 },
  secretario: { center: true, mask: { w: 320, h: 17 }, italic: true, align: "center" },
  resolucao: { center: true, mask: { w: 260, h: 16 }, italic: true, align: "center" },
  serial: { mask: { w: 118, h: 16 }, bold: true, color: "#6b6b6b", align: "left" },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...DIPLOMA_DEFAULT_POSITIONS };
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

export function buildDiplomaHtml(
  d: Record<string, string>,
  fieldPositions?: unknown,
  qrValue?: string,
) {
  const p = resolvePositions(fieldPositions);

  const pageOf = (id: string) => (p[id].y >= PAGE_H ? 2 : 1);
  const topOf = (id: string) => (pageOf(id) === 2 ? p[id].y - PAGE_H : p[id].y);

  /** Monta o HTML de um campo de texto. */
  const node = (id: string, inner: string) => {
    if (!inner) return "";
    const pos = p[id];
    const st = STYLES[id] || {};
    const css: string[] = [
      `top:${topOf(id)}px`,
      `left:${pos.x}px`,
      `font-size:${pos.fontSize}px`,
      `line-height:${st.lineHeight ? `${st.lineHeight}px` : "1.2"}`,
    ];
    if (st.bold) css.push("font-weight:bold");
    if (st.italic) css.push("font-style:italic");
    if (st.color) css.push(`color:${st.color}`);

    if (st.mask) {
      css.push(`width:${st.mask.w}px`, `height:${st.mask.h}px`, "background:#fff");
      css.push("display:flex", "align-items:center");
      css.push(st.align === "left" ? "justify-content:flex-start" : "justify-content:center");
      if (st.center) css.push("transform:translateX(-50%)");
    } else {
      if (st.width) css.push(`width:${st.width}px`);
      if (st.center) css.push("transform:translateX(-50%)", "text-align:center");
    }
    return `<div class="ov" style="${css.join(";")}">${inner}</div>`;
  };

  const text = (id: string, value: string) => node(id, nl2br(value || ""));

  // Corpo do diploma: partes fixas em itálico, dados variáveis em regular.
  const fx = (t: string) => `<span class="fx">${escapeHtml(t)}</span>`;
  const vr = (t: string) => `<span class="vr">${escapeHtml(t)}</span>`;
  const corpo =
    `${fx("O(A) Reitor(a) do")} ${vr(d.instituicao)}${fx(", no uso de suas atribuições, tendo em vista a conclusão do")} ` +
    `${vr(d.curso_completo)}${fx(", na data de")} ${vr(d.data_conclusao)}${fx(", e a colação de grau na data de")} ` +
    `${vr(d.data_colacao)}${fx(", confere o título de")} ${vr(d.titulo)} ${fx("a")} ` +
    `${vr(d.aluno)}${fx(", nacionalidade")} ${vr(d.nacionalidade)}${fx(", natural de")} ${vr(d.naturalidade)}${fx(",")} ` +
    `${fx("nascido(a) em")} ${vr(d.nascimento)}${fx(", portador(a) da Cédula de Identidade")} ${vr(d.identidade)}${fx(", órgão expedidor")} ` +
    `${vr(d.orgao_expedidor)}${fx(", e outorga-lhe o presente Diploma, a fim de que possa gozar de todos os direitos e prerrogativas legais.")}`;

  const qrBox = () => {
    if (!qrValue) return "";
    const pos = p.qr;
    return `<div class="ov qr-box" style="top:${topOf("qr")}px;left:${pos.x}px;width:${pos.w}px;height:${pos.h}px">${qrSvg(qrValue, pos.w ?? 110)}</div>`;
  };

  const sheet = (bg: string, content: string, last = false) => `
  <div class="sheet"${last ? ' style="page-break-after:auto"' : ""}>
    <div class="canvas">
      ${bg ? `<img class="bg" src="${escapeHtml(bg)}" />` : ""}
      ${content}
    </div>
  </div>`;

  const page1 = [
    node("rep_federativa", escapeHtml("REPÚBLICA FEDERATIVA DO BRASIL")),
    node("ministerio", escapeHtml("MINISTÉRIO DA EDUCAÇÃO")),
    text("inst_l1", d.instituicao_l1),
    text("inst_l2", d.instituicao_l2),
    node("corpo", corpo),
    text("cidade_data", d.cidade_data),
    text("reitor", d.reitor),
    text("rodape_inst", d.instituicao),
    node(
      "rodape_validacao",
      escapeHtml(`Código de Validação: ${d.codigo_validacao} | ${d.url_validacao}`),
    ),
  ].join("\n");

  const page2 = [
    text("p2_esq_nome", d.instituicao),
    text("p2_esq_razao", `${d.mantenedora}\nCNPJ: ${d.cnpj}`),
    text("p2_esq_cred", d.credenciamento),
    text("p2_esq_recred", d.recredenciamento),
    text("p2_curso", `Curso de ${d.curso}`),
    text("p2_reconhecimento", d.reconhecimento),
    text("p2_renovacao", d.renovacao),
    text("p2_dir_recred", d.recredenciamento_universidade),
    text("p2_registro", d.registro_texto),
    text("p2_processo", d.processo),
    text("p2_cidade_data", d.registro_cidade_data),
    text("secretario", d.secretario),
    text("resolucao", d.resolucao),
    qrBox(),
    text("serial", d.serial),
  ].join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    background: #fff;
    width: ${SHEET_W}px;
  }
  .sheet {
    width: ${SHEET_W}px;
    height: ${SHEET_H}px;
    position: relative;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
  }
  .canvas {
    position: absolute;
    top: ${OFFSET_TOP}px;
    left: 0;
    width: ${PAGE_W}px;
    height: ${PAGE_H}px;
    transform: scale(${SCALE});
    transform-origin: top left;
  }
  .bg { position: absolute; top: 0; left: 0; width: ${PAGE_W}px; height: ${PAGE_H}px; image-rendering: high-quality; }
  .ov {
    position: absolute;
    z-index: 10;
    color: #111;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
  }
  .fx { font-style: italic; color: #555; }
  .vr { font-style: normal; color: #111; }
  .qr-box { background: #fff; z-index: 12; overflow: hidden; }
  .qr-box svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
${sheet(d.template_p1 || "", page1)}
${sheet(d.template_p2 || "", page2, true)}
</body>
</html>`;
}

/* ------------------------------------------------ payload do portal */

function buildPortalPayload(
  b: Record<string, string>,
  documentoId: string,
): Record<string, unknown> {
  const sexo = /^f/i.test(b.sexo || "") ? "Feminino" : "Masculino";
  const titulo = flexTitulo(b.titulo || "", sexo);

  return {
    documento_id: documentoId,
    codigo_validacao: documentoId,
    tipo_documento: "diploma-estacio",
    modelo: b.modelo || "",

    nome_aluno: (b.aluno || "").toUpperCase(),
    cpf: maskCpf(b.cpf || ""),
    rg: b.identidade || "",
    data_nascimento: toIsoDate(b.nascimento || ""),
    sexo,

    curso_nome: (b.curso || "").toUpperCase(),
    curso_nome_completo: (b.curso_completo || "").toUpperCase(),
    grau: titulo,
    data_colacao: toIsoDate(b.data_colacao || ""),
    data_expedicao: toIsoDate(b.data_expedicao || b.registro_data || ""),

    unidade_nome: b.instituicao || "",
    unidade_cidade: b.registro_cidade || b.cidade_expedicao || "",
    unidade_uf: b.uf || "",

    numero_registro: b.registro_numero || "",
    numero_livro: b.registro_livro || "",
    numero_folha: b.registro_folha || "",
    numero_processo: b.processo_numero || "",
    data_registro: toIsoDate(b.registro_data || ""),

    dados_completos: {
      sexo,
      aluno: {
        nome: (b.aluno || "").toUpperCase(),
        cpf: maskCpf(b.cpf || ""),
        rg: b.identidade || "",
        sexo,
        nascimento: toIsoDate(b.nascimento || ""),
        naturalidade: b.naturalidade || "",
        nacionalidade: b.nacionalidade || "Brasileira",
        mae: b.mae || "",
      },
      ies: {
        razao_social: b.instituicao || "",
        cnpj: maskCnpj(b.cnpj || ""),
        codigo_mec: b.codigo_mec || "",
        municipio: b.registro_cidade || b.cidade_expedicao || "",
        uf: b.uf || "",
        credenciamento_texto: b.credenciamento || "",
        recredenciamento_texto: b.recredenciamento || "",
      },
      mantenedora: {
        razao_social: b.mantenedora || "",
        cnpj: maskCnpj(b.cnpj || ""),
      },
      curso: {
        nome: (b.curso || "").toUpperCase(),
        nome_completo: (b.curso_completo || "").toUpperCase(),
        codigo_emec: b.codigo_emec || "",
        grau: titulo,
        modalidade: b.modalidade || "",
        titulo_conferido: titulo,
        carga_horaria: b.carga_horaria || "",
        conclusao: toIsoDate(b.data_conclusao || ""),
        colacao: toIsoDate(b.data_colacao || ""),
        reconhecimento_texto: b.reconhecimento || "",
        renovacao_texto: b.renovacao || "",
      },
      registro: {
        numero: b.registro_numero || "",
        livro: b.registro_livro || "",
        folha: b.registro_folha || "",
        processo: b.processo_numero || "",
        data: toIsoDate(b.registro_data || ""),
        responsavel: b.secretario || "",
        texto: b.registro_texto || "",
      },
      reitor: b.reitor || "",
      serial: b.serial || "",
    },
  };
}

/* ---------------------------------------------------------------- serve */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    /* ---- registro no portal (chamado após a geração, com PDF + preview) ---- */
    if (body.action === "register_portal") {
      const form = (body.form || {}) as Record<string, string>;
      const documentoId =
        body.documento_id ||
        (await buildDocumentoId(
          `${form.aluno || ""}|${form.curso || ""}|${form.identidade || ""}`,
          form.data_colacao,
        ));

      const payload = buildPortalPayload(form, documentoId);
      if (body.pdf_base64) payload.pdf_base64 = body.pdf_base64;
      if (body.pdf_preview_base64) payload.pdf_preview_base64 = body.pdf_preview_base64;

      const result = await registerDiplomaPortal(documentoId, payload);
      return new Response(
        JSON.stringify({
          success: result.registered,
          documento_id: result.documentoId,
          validation_url: result.validationUrl,
          error: result.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY");
    const PDFCO_API_KEY = Deno.env.get("PDFCO_API_KEY");

    // documento_id determinístico → a URL do QR é conhecida antes do registro.
    const documentoId = await buildDocumentoId(
      `${body.aluno || ""}|${body.curso || ""}|${body.identidade || ""}`,
      body.data_colacao,
    );
    const urlValidacao = buildValidationUrl(documentoId);
    const codigo = body.codigo_validacao || documentoId;

    const data: Record<string, string> = {

      instituicao: body.instituicao || "",
      instituicao_l1: body.instituicao_l1 || "",
      instituicao_l2: body.instituicao_l2 || "",
      curso: body.curso || "",
      curso_completo: body.curso_completo || "",
      titulo: body.titulo || "",
      aluno: body.aluno || "",
      nacionalidade: body.nacionalidade || "BRASILEIRO(A)",
      naturalidade: body.naturalidade || "",
      nascimento: body.nascimento || "",
      identidade: body.identidade || "",
      orgao_expedidor: body.orgao_expedidor || "",
      data_conclusao: body.data_conclusao || "",
      data_colacao: body.data_colacao || "",
      cidade_data: body.cidade_data || "",
      reitor: body.reitor || "",
      secretario: body.secretario || "",
      resolucao: body.resolucao || "",
      mantenedora: body.mantenedora || "",
      cnpj: body.cnpj || "",
      credenciamento: body.credenciamento || "",
      recredenciamento: body.recredenciamento || "",
      reconhecimento: body.reconhecimento || "",
      renovacao: body.renovacao || "",
      recredenciamento_universidade: body.recredenciamento_universidade || "",
      registro_texto: body.registro_texto || "",
      processo: body.processo || "",
      registro_cidade_data: body.registro_cidade_data || "",
      serial: body.serial || "",
      codigo_validacao: codigo,
      url_validacao: urlValidacao,
      template_p1: body.template_p1_base64 || "",
      template_p2: body.template_p2_base64 || "",
    };

    const html = buildDiplomaHtml(data, body.field_positions, urlValidacao);

    // Renderizacao no proprio navegador (sem servico externo de PDF).
    if ((body as any).render === "html") {
      return new Response(
        JSON.stringify({
          success: true,
          render: "browser",
          html,
          codigo_validacao: codigo,
          documento_id: documentoId,
          validation_url: urlValidacao,
          qr_code_url: urlValidacao,
          
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
      if (!PDFCO_API_KEY) throw new Error("PDF generation failed and PDF.co fallback is not configured");
      pdfBuffer = await generateWithPdfCo(html, PDFCO_API_KEY);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: `data:application/pdf;base64,${bytesToBase64(pdfBuffer)}`,
        codigo_validacao: codigo,
        documento_id: documentoId,
        validation_url: urlValidacao,
        qr_code_url: urlValidacao,

      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Diploma PDF:", error);
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
