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

type Pos = { x: number; y: number; fontSize: number; w?: number; h?: number; rotate?: number };

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultObitoFields
export const OBITO_DEFAULT_POSITIONS: Record<string, Pos> = {
  nome: { x: 105.5, y: 247.4, fontSize: 13.5, w: 575 },
  cpf: { x: 113.2, y: 283.4, fontSize: 8.5, w: 288 },
  matricula: { x: 105.5, y: 315.4, fontSize: 13.5, w: 575 },

  sexo: { x: 107.4, y: 352.5, fontSize: 8.5, w: 88 },
  cor: { x: 209, y: 352.5, fontSize: 8.5, w: 88 },
  estado_civil: { x: 308.8, y: 352.5, fontSize: 8.5, w: 369 },

  naturalidade: { x: 107.4, y: 386.1, fontSize: 8.3, w: 228 },
  documento_id: { x: 341.4, y: 386.1, fontSize: 8.3, w: 225 },
  eleitor: { x: 575.3, y: 386, fontSize: 8.5, w: 105 },

  filiacao: { x: 111.2, y: 422.6, fontSize: 8.3, w: 568 },

  data_hora_falec: { x: 111.2, y: 464.8, fontSize: 8.3, w: 398 },
  dia: { x: 522.6, y: 464.8, fontSize: 8.3, w: 40 },
  mes: { x: 567.7, y: 464.8, fontSize: 8.3, w: 48 },
  ano: { x: 626.2, y: 464.8, fontSize: 8.3, w: 53 },

  local_falec: { x: 111.2, y: 497.4, fontSize: 8.3, w: 568 },
  causa_morte: { x: 111.2, y: 531.9, fontSize: 8.3, w: 568 },

  sepultamento: { x: 111.2, y: 563.5, fontSize: 8.3, w: 360 },
  declarante: { x: 489, y: 563.5, fontSize: 8.3, w: 190 },

  medico: { x: 111.2, y: 597.1, fontSize: 8.3, w: 568 },
  averbacoes: { x: 111.2, y: 632, fontSize: 7.6, w: 568 },
  anotacoes: { x: 111.2, y: 707.4, fontSize: 8.3, w: 568 },

  lavrada: { x: 95.9, y: 726.5, fontSize: 8.3, w: 585 },
  dou_fe: { x: 95.9, y: 771.6, fontSize: 8.3, w: 585 },
  emitida: { x: 95.9, y: 787.9, fontSize: 8.3, w: 585 },
  mp_texto: { x: 95.9, y: 801.3, fontSize: 8.3, w: 585 },

  cartorio: { x: 92.1, y: 826.3, fontSize: 8.3, w: 280 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...OBITO_DEFAULT_POSITIONS };
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

/** Reduz a fonte quando o texto é longo demais — nunca corta com "…". */
function fitTextStyle(value: string, baseSize: number, maxWidth: number, minRatio = 0.6) {
  const len = (value || "").trim().length;
  if (!len || !maxWidth) return "";
  const charRatio = 0.52;
  const estimated = len * baseSize * charRatio;
  if (estimated <= maxWidth) return "";
  const fitted = maxWidth / (len * charRatio);
  const size = Math.max(fitted, baseSize * minRatio);
  return `font-size:${size.toFixed(2)}px;`;
}

/* -------------------------------------------------------------- extenso */

const UNIDADES = [
  "", "UM", "DOIS", "TRÊS", "QUATRO", "CINCO", "SEIS", "SETE", "OITO", "NOVE", "DEZ",
  "ONZE", "DOZE", "TREZE", "QUATORZE", "QUINZE", "DEZESSEIS", "DEZESSETE", "DEZOITO", "DEZENOVE",
];
const DEZENAS = ["", "", "VINTE", "TRINTA", "QUARENTA", "CINQUENTA", "SESSENTA", "SETENTA", "OITENTA", "NOVENTA"];
const CENTENAS = [
  "", "CENTO", "DUZENTOS", "TREZENTOS", "QUATROCENTOS", "QUINHENTOS",
  "SEISCENTOS", "SETECENTOS", "OITOCENTOS", "NOVECENTOS",
];
export const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

/** Número por extenso de 0 a 999. */
function ate999(n: number): string {
  if (n <= 0) return "";
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS[d]} E ${UNIDADES[u]}` : DEZENAS[d];
  }
  if (n === 100) return "CEM";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto ? `${CENTENAS[c]} E ${ate999(resto)}` : CENTENAS[c];
}

/** Ano por extenso no padrão da certidão de óbito (ex.: MIL NOVECENTOS E OITENTA E DOIS). */
export function anoExtenso(ano: number): string {
  if (!ano || ano < 1000) return "";
  const milhares = Math.floor(ano / 1000);
  const resto = ano % 1000;
  const prefixo = milhares === 1 ? "MIL" : `${UNIDADES[milhares]} MIL`;
  if (!resto) return prefixo;
  return resto < 100 ? `${prefixo} E ${ate999(resto)}` : `${prefixo} ${ate999(resto)}`;
}

/** "19/01/1982" -> "DEZENOVE DE JANEIRO DE MIL NOVECENTOS E OITENTA E DOIS" */
export function dataExtenso(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return "";
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (!dia || mes < 1 || mes > 12) return "";
  return `${ate999(dia)} DE ${MESES[mes - 1]} DE ${anoExtenso(ano)}`;
}

/** "11/01/2022" -> "11 de Janeiro de 2022" */
export function dataPorExtensoCurta(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return "";
  const mes = MESES[Number(m[2]) - 1] || "";
  const nome = mes ? mes.charAt(0) + mes.slice(1).toLowerCase() : "";
  return `${m[1]} de ${nome} de ${m[3]}`;
}

/* --------------------------------------------------------------- layout */

export function buildObitoHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const CENTER = new Set([
    "nome", "matricula", "sexo", "cor", "eleitor", "dia", "mes", "ano", "declarante",
    "lavrada", "dou_fe", "emitida", "mp_texto", "cartorio",
  ]);
  const BOLD = new Set([
    "nome", "cpf", "matricula", "sexo", "cor", "estado_civil", "naturalidade", "documento_id",
    "eleitor", "filiacao", "data_hora_falec", "dia", "mes", "ano", "local_falec", "causa_morte",
    "sepultamento", "declarante", "medico", "averbacoes", "anotacoes",
  ]);

  // Textos longos: quebram em várias linhas em vez de encolher a fonte.
  const WRAP = new Set(["filiacao", "averbacoes", "lavrada", "mp_texto", "cartorio"]);

  const field = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 300;
    const fit = WRAP.has(id) ? "" : fitTextStyle(text, pos.fontSize, width);
    const align = CENTER.has(id) ? "center" : "left";
    const weight = BOLD.has(id) ? 700 : 400;
    const html = escapeHtml(text).replace(/\n/g, "<br/>");
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};font-weight:${weight};${extra}">${html}</div>`;
  };

  const dataFalec = (d.data_falecimento || "").trim();
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataFalec);

  const horaFalec = (d.hora_falecimento || "").trim();
  const dataHora = [dataExtenso(dataFalec), horaFalec ? `ÀS ${horaFalec.toUpperCase()}` : ""]
    .filter(Boolean)
    .join(" - ");

  const cidadeUf = `${d.cartorio_cidade || ""}${d.cartorio_uf ? ` - ${d.cartorio_uf}` : ""}`;
  const lavrada =
    `Certidão lavrada por ${d.escrevente || ""} - ESCREVENTE do Registro Civil das Pessoas Naturais de ` +
    `${d.cartorio_cidade || ""}, o(a) qual assinou eletronicamente aos ${dataPorExtensoCurta(d.data_emissao || "")}, ` +
    `nos termos do Provimento nº 46/2015 do Conselho Nacional de Justiça`;

  const cartorio = [
    "Oficial de Registro Civil das Pessoas Naturais",
    cidadeUf,
    `${d.oficial || ""} - Oficial`,
    d.cartorio_endereco || "",
    d.cartorio_cep || "",
    d.cartorio_email ? `E-mail: ${d.cartorio_email}` : "",
    d.cartorio_telefone ? `Tel: ${d.cartorio_telefone}` : "",
  ].filter(Boolean).join("\n");

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
  .overlay {
    position: absolute;
    z-index: 10;
    color: #111;
    line-height: 1.42;
    white-space: normal;
    overflow: visible;
  }
</style>
</head>
<body>
<div class="page">
  <div class="bg-template">${templateBg ? `<img src="${escapeHtml(templateBg)}" />` : ""}</div>

  ${field("nome", (d.nome || "").toUpperCase())}
  ${field("cpf", (d.cpf || "").toUpperCase())}
  ${field("matricula", d.matricula || "")}

  ${field("sexo", (d.sexo || "").toUpperCase())}
  ${field("cor", (d.cor || "").toUpperCase())}
  ${field("estado_civil", (d.estado_civil || "").toUpperCase())}

  ${field("naturalidade", (d.naturalidade || "").toUpperCase())}
  ${field("documento_id", (d.documento_id || "").toUpperCase())}
  ${field("eleitor", (d.eleitor || "").toUpperCase())}

  ${field("filiacao", (d.filiacao || "").toUpperCase())}

  ${field("data_hora_falec", dataHora)}
  ${field("dia", partes ? partes[1] : "")}
  ${field("mes", partes ? partes[2] : "")}
  ${field("ano", partes ? partes[3] : "")}

  ${field("local_falec", (d.local_falecimento || "").toUpperCase())}
  ${field("causa_morte", (d.causa_morte || "").toUpperCase())}

  ${field("sepultamento", (d.sepultamento || "").toUpperCase())}
  ${field("declarante", (d.declarante || "").toUpperCase())}

  ${field("medico", (d.medico || "").toUpperCase())}
  ${field("averbacoes", (d.averbacoes || "").toUpperCase(), "text-align:justify;")}
  ${field("anotacoes", (d.anotacoes || "").toUpperCase())}

  ${field("lavrada", lavrada)}
  ${field("dou_fe", "O conteúdo da certidão é verdadeiro. Dou fé")}
  ${field("emitida", `Certidão emitida em ${dataPorExtensoCurta(d.data_emissao || "")}`)}
  ${field(
    "mp_texto",
    "Este é um documento público eletrônico, emitido nos termos da Medida Provisória 2200-2, de 24/08/2001, só tendo validade em formato digital, vedada a sua reprodução.",
  )}

  ${field("cartorio", cartorio, "line-height:1.62;")}
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
      "nome", "cpf", "matricula", "sexo", "cor", "estado_civil", "naturalidade",
      "documento_id", "eleitor", "filiacao", "data_falecimento", "hora_falecimento",
      "local_falecimento", "causa_morte", "sepultamento", "declarante", "medico",
      "averbacoes", "anotacoes", "data_emissao",
      "cartorio_cidade", "cartorio_uf", "oficial", "escrevente",
      "cartorio_endereco", "cartorio_cep", "cartorio_email", "cartorio_telefone",
    ];

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildObitoHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Certidão de Óbito:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
