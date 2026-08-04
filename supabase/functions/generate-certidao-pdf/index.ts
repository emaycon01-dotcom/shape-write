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

// Defaults MUST match src/pages/TemplateAlignPage.tsx defaultCertidaoFields
export const CERTIDAO_DEFAULT_POSITIONS: Record<string, Pos> = {
  nome: { x: 197, y: 243, fontSize: 13.5, w: 400 },
  cpf: { x: 118, y: 275.5, fontSize: 8.5, w: 200 },
  matricula: { x: 197, y: 301.5, fontSize: 13.5, w: 400 },

  nasc_extenso: { x: 116.6, y: 347, fontSize: 8.3, w: 520 },
  dia: { x: 526, y: 336.5, fontSize: 8.3, w: 40 },
  mes: { x: 577, y: 336.5, fontSize: 8.3, w: 40 },
  ano: { x: 633, y: 336.5, fontSize: 8.3, w: 40 },

  hora: { x: 143, y: 378, fontSize: 8.3, w: 90 },
  naturalidade: { x: 234, y: 378, fontSize: 8.3, w: 250 },

  municipio_registro: { x: 116.6, y: 418, fontSize: 8.3, w: 240 },
  local_nasc: { x: 372, y: 404, fontSize: 7.4, w: 225 },
  sexo: { x: 592, y: 409, fontSize: 8.5, w: 95 },

  filiacao: { x: 116.6, y: 448.9, fontSize: 8.3, w: 560 },
  avos: { x: 116.6, y: 479, fontSize: 8.3, w: 560 },

  gemeos: { x: 126, y: 509, fontSize: 8.3, w: 55 },
  nome_gemeos: { x: 228, y: 509, fontSize: 8.3, w: 380 },

  registro_extenso: { x: 116.6, y: 549, fontSize: 8.3, w: 430 },

  lavrada: { x: 97, y: 627, fontSize: 8.3, w: 600 },
  dou_fe: { x: 97, y: 655.9, fontSize: 8.3, w: 600 },
  emitida: { x: 97, y: 672.4, fontSize: 8.3, w: 600 },
  mp_texto: { x: 97, y: 689, fontSize: 8.3, w: 600 },

  cartorio: { x: 97, y: 726.6, fontSize: 8.3, w: 310 },
};

function resolvePositions(overrides: unknown): Record<string, Pos> {
  const result: Record<string, Pos> = { ...CERTIDAO_DEFAULT_POSITIONS };
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

/** Ano por extenso no padrão cartorial (ex.: UM MIL E NOVECENTOS E NOVENTA). */
export function anoExtenso(ano: number): string {
  if (!ano || ano < 1000) return "";
  const milhares = Math.floor(ano / 1000);
  const resto = ano % 1000;
  const prefixo = milhares === 1 ? "UM MIL" : `${UNIDADES[milhares]} MIL`;
  if (!resto) return prefixo;
  return `${prefixo} E ${ate999(resto)}`;
}

/** "27/02/1990" -> "VINTE E SETE DE FEVEREIRO DE UM MIL E NOVECENTOS E NOVENTA" */
export function dataExtenso(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return "";
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (!dia || mes < 1 || mes > 12) return "";
  return `${ate999(dia)} DE ${MESES[mes - 1]} DE ${anoExtenso(ano)}`;
}

/** "01/02/2023" -> "01 de Fevereiro de 2023" */
export function dataPorExtensoCurta(data: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((data || "").trim());
  if (!m) return "";
  const mes = MESES[Number(m[2]) - 1] || "";
  const nome = mes ? mes.charAt(0) + mes.slice(1).toLowerCase() : "";
  return `${m[1]} de ${nome} de ${m[3]}`;
}

/* --------------------------------------------------------------- layout */

export function buildCertidaoHtml(d: Record<string, string>, fieldPositions?: unknown) {
  const templateBg = d.template_bg || "";
  const p = resolvePositions(fieldPositions);

  const CENTER = new Set([
    "nome", "matricula", "dia", "mes", "ano", "sexo",
    "lavrada", "dou_fe", "emitida", "mp_texto", "cartorio",
  ]);
  const BOLD = new Set([
    "nome", "cpf", "matricula", "nasc_extenso", "dia", "mes", "ano", "hora", "naturalidade",
    "municipio_registro", "local_nasc", "sexo", "filiacao", "avos", "gemeos", "nome_gemeos",
    "registro_extenso",
  ]);

  const field = (id: string, text: string, extra = "") => {
    const pos = p[id];
    if (!pos || !text) return "";
    const width = pos.w ?? 300;
    const fit = fitTextStyle(text, pos.fontSize, width);
    const align = CENTER.has(id) ? "center" : "left";
    const weight = BOLD.has(id) ? 700 : 400;
    const html = escapeHtml(text).replace(/\n/g, "<br/>");
    return `<div class="overlay" style="top:${pos.y}px;left:${pos.x}px;width:${width}px;font-size:${pos.fontSize}px;${fit}text-align:${align};font-weight:${weight};${extra}">${html}</div>`;
  };

  const dataNasc = (d.data_nasc || "").trim();
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataNasc);

  const cidadeUf = `${d.cartorio_cidade || ""}${d.cartorio_uf ? ` - ${d.cartorio_uf}` : ""}`;
  const lavrada =
    `Certidão lavrada por ${d.escrevente || ""} - Escrevente do Registro Civil das Pessoas Naturais de ` +
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
  ${field("cpf", d.cpf || "")}
  ${field("matricula", d.matricula || "")}

  ${field("nasc_extenso", dataExtenso(dataNasc))}
  ${field("dia", partes ? partes[1] : "")}
  ${field("mes", partes ? partes[2] : "")}
  ${field("ano", partes ? partes[3] : "")}

  ${field("hora", (d.hora_nasc || "").toUpperCase())}
  ${field("naturalidade", (d.naturalidade || "").toUpperCase())}

  ${field("municipio_registro", (d.municipio_registro || "").toUpperCase())}
  ${field("local_nasc", (d.local_nasc || "").toUpperCase())}
  ${field("sexo", (d.sexo || "").toUpperCase())}

  ${field("filiacao", (d.filiacao || "").toUpperCase())}
  ${field("avos", (d.avos || "").toUpperCase())}

  ${field("gemeos", (d.gemeos || "NÃO").toUpperCase())}
  ${field("nome_gemeos", (d.nome_gemeos || "").toUpperCase())}

  ${field("registro_extenso", dataExtenso(d.data_registro || ""))}

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
      "nome", "cpf", "matricula", "data_nasc", "hora_nasc", "naturalidade",
      "municipio_registro", "local_nasc", "sexo", "filiacao", "avos",
      "gemeos", "nome_gemeos", "data_registro", "data_emissao",
      "cartorio_cidade", "cartorio_uf", "oficial", "escrevente",
      "cartorio_endereco", "cartorio_cep", "cartorio_email", "cartorio_telefone",
    ];

    const data: Record<string, string> = { template_bg: body.template_base64 || "" };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildCertidaoHtml(data, body.field_positions);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Certidão de Nascimento:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
