import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface LinhaHistorico {
  ano: string;
  serie: string;
  disciplina: string;
  ch: string;
  freq: string;
  media: string;
  situacao: string;
}

/* ---------------------------------------------------------- paginação */

const ROW_H = 17.4;        // altura de cada linha da tabela
const HEAD_H = 20;         // cabeçalho da tabela
const GAP_H = 9;           // respiro entre semestres
const CAP_PAGE = 660;      // altura útil de tabela por página
const RESERVA_FIM = 250;   // espaço do bloco final (ENADE, diploma, assinatura)

function alturaGrupo(g: LinhaHistorico[]) {
  return g.length * ROW_H + GAP_H;
}

/** Distribui os grupos de semestre em páginas sem quebrar um semestre ao meio. */
export function paginar(grupos: LinhaHistorico[][]): LinhaHistorico[][][] {
  const paginas: LinhaHistorico[][][] = [];
  let atual: LinhaHistorico[][] = [];
  let altura = HEAD_H;

  for (const g of grupos) {
    const h = alturaGrupo(g);
    if (atual.length && altura + h > CAP_PAGE) {
      paginas.push(atual);
      atual = [];
      altura = HEAD_H;
    }
    atual.push(g);
    altura += h;
  }
  if (atual.length) paginas.push(atual);
  if (!paginas.length) paginas.push([]);

  // O bloco final precisa de espaço: se não couber, abre mais uma página.
  const ultima = paginas[paginas.length - 1];
  const hUltima = HEAD_H + ultima.reduce((a, g) => a + alturaGrupo(g), 0);
  if (hUltima > CAP_PAGE - RESERVA_FIM) {
    if (ultima.length > 1) {
      // empurra os últimos semestres para uma nova página
      const nova: LinhaHistorico[][] = [];
      let h = hUltima;
      while (ultima.length > 1 && h > CAP_PAGE - RESERVA_FIM) {
        const g = ultima.pop()!;
        nova.unshift(g);
        h -= alturaGrupo(g);
      }
      paginas.push(nova);
    } else {
      paginas.push([]);
    }
  }

  return paginas;
}

/* ------------------------------------------------------------- layout */

export function buildAnhangueraHistoricoHtml(
  d: Record<string, string>,
  grupos: LinhaHistorico[][],
) {
  const paginas = paginar(grupos);
  const total = paginas.length;

  const cabecalho = `
  <div class="head">
    <div class="logo">${d.logo_base64 ? `<img src="${escapeHtml(d.logo_base64)}" alt="" />` : ""}</div>
    <div class="head-txt">
      <div class="cidade">${escapeHtml(d.cidade_uf || "")}</div>
      <div class="fac">${escapeHtml((d.faculdade || "").toUpperCase())}</div>
      <div class="end">${escapeHtml(d.endereco_faculdade || "")}</div>
    </div>
  </div>
  <div class="titulo">HISTÓRICO ESCOLAR</div>

  <table class="dados">
    <tr>
      <td class="lbl">Nome:</td><td class="val">${escapeHtml(d.nome || "")}</td>
      <td class="lbl r">RA:</td><td class="val w22">${escapeHtml(d.ra || "")}</td>
    </tr>
    <tr>
      <td class="lbl">Natural do Estado:</td><td class="val">${escapeHtml(d.natural_estado || "")}</td>
      <td class="lbl r">Nascimento:</td><td class="val">${escapeHtml(d.nascimento || "")}</td>
    </tr>
    <tr>
      <td class="lbl">Doc. Identidade:</td><td class="val">${escapeHtml(d.doc_identidade || "")}</td>
      <td class="lbl r">Nacionalidade:</td><td class="val">${escapeHtml(d.nacionalidade || "brasileira")}</td>
    </tr>
    <tr>
      <td class="lbl">Titulação do Curso:</td><td class="val" colspan="3">${escapeHtml(d.titulacao || "")}</td>
    </tr>
    <tr>
      <td class="lbl top">Ingresso:</td><td class="val" colspan="3">${escapeHtml(d.ingresso || "")}</td>
    </tr>
    <tr>
      <td class="lbl">Classificação:</td><td class="val" colspan="3">${escapeHtml(d.classificacao || "")}</td>
    </tr>
  </table>
  <table class="dados dados2">
    <tr><td class="lbl">Curso:</td><td class="val" colspan="3">${escapeHtml(d.curso || "")}</td></tr>
    <tr><td class="lbl">Regime:</td><td class="val" colspan="3">${escapeHtml(d.regime || "Semestral")}</td></tr>
    <tr><td class="val port" colspan="4">${escapeHtml(d.portaria || "")}</td></tr>
  </table>`;

  const rodape = `
  <div class="rodape">
    <div>Este documento foi assinado digitalmente por ${escapeHtml((d.secretaria_nome || "").toUpperCase())}.</div>
    <div>Se impresso, para conferência acesse o site ${escapeHtml(d.site_validacao || "http://sada.anhanguera.com")} e informe o código de documento: ${escapeHtml(d.codigo_documento || "")}.</div>
  </div>`;

  const cols = `<colgroup>
    <col class="w7"><col class="w12"><col class="wd"><col class="w7"><col class="w8"><col class="w9"><col class="w13">
  </colgroup>`;

  const tabelaHead = `
    <tr>
      <th class="w7">ANO</th>
      <th class="w12">SÉRIE/SEM</th>
      <th class="wd">DISCIPLINAS</th>
      <th class="w7">C.H.</th>
      <th class="w8">% FREQ</th>
      <th class="w9">MÉDIA</th>
      <th class="w13">SITUAÇÃO</th>
    </tr>`;

  const linhaHtml = (l: LinhaHistorico) => `
    <tr>
      <td>${escapeHtml(l.ano)}</td>
      <td>${escapeHtml(l.serie)}</td>
      <td class="disc">${escapeHtml(l.disciplina)}</td>
      <td class="n">${escapeHtml(l.ch)}</td>
      <td class="n">${escapeHtml(l.freq)}</td>
      <td class="n">${escapeHtml(l.media)}</td>
      <td class="disc">${escapeHtml(l.situacao)}</td>
    </tr>`;

  const blocoFinal = `
  <div class="enade">"${escapeHtml(d.enade_texto || "Estudante dispensado de realização do ENADE, em razão do calendário trienal")}"</div>
  <div class="chleg">C.H. Carga Horária</div>

  <table class="diploma">
    <tr>
      <td class="dl">Diploma de: ${escapeHtml(d.diploma_curso || d.curso || "")}</td>
      <td class="dr">Carga horária de ${escapeHtml(d.carga_horaria || "")}</td>
    </tr>
  </table>
  <table class="diploma dg2">
    <tr>
      <td class="dl">Data da Colação de Grau</td>
      <td class="dr">Data de Expedição do Diploma</td>
    </tr>
    <tr>
      <td class="dl">${escapeHtml(d.data_colacao || "")}</td>
      <td class="dr">${escapeHtml(d.data_expedicao || "")}</td>
    </tr>
  </table>

  <div class="assina">
    <div>${escapeHtml(d.local_data || "")}</div>
    <div class="nome">${escapeHtml(d.secretaria_nome || "")}</div>
    <div>${escapeHtml(d.secretaria_cargo || "Secretaria")}</div>
  </div>`;

  const paginasHtml = paginas
    .map((grupos, idx) => {
      const ultima = idx === total - 1;
      const corpo = grupos
        .map(
          (g) => `<table class="notas">${cols}${g.map(linhaHtml).join("")}</table>`,
        )
        .join("");
      return `
<div class="page">
  ${cabecalho}
  <div class="tabelas">
    <table class="notas cabec">${cols}${tabelaHead}</table>
    ${corpo}
  </div>
  ${ultima ? blocoFinal : ""}
  ${rodape}
</div>`;
    })
    .join("");

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
    color: #1a1a1a;
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
    font-variant-ligatures: none;
    font-kerning: none;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; padding: 40px 46px 54px; }

  .head { display: flex; align-items: flex-start; gap: 14px; }
  .logo { width: 108px; flex: 0 0 108px; }
  .logo img { width: 100%; height: auto; object-fit: contain; }
  .head-txt { flex: 1; text-align: center; padding-top: 4px; }
  .head-txt .cidade { font-size: 9px; }
  .head-txt .fac { font-size: 13.5px; font-weight: 700; margin-top: 1px; }
  .head-txt .end { font-size: 8.6px; margin-top: 2px; }

  .titulo { text-align: center; font-size: 11.5px; font-weight: 700; margin: 14px 0 12px; }

  table { width: 100%; border-collapse: collapse; }
  .dados td { border: 1px solid #1a1a1a; font-size: 9.4px; padding: 4px 7px; height: 19px; vertical-align: top; }
  .dados .lbl { white-space: nowrap; border-right: 0; width: 1%; }
  .dados .val { border-left: 0; }
  .dados .r { text-align: right; }
  .dados .w22 { width: 22%; }
  .dados2 { margin-top: 7px; }
  .dados2 td { border: 0; padding: 2px 7px; }
  .dados2 { border: 1px solid #1a1a1a; }
  .dados2 .port { padding-top: 4px; padding-bottom: 4px; }

  .tabelas { margin-top: 16px; }
  .notas { table-layout: fixed; }
  .notas th, .notas td {
    border: 1px solid #1a1a1a;
    font-size: 8.7px;
    padding: 2px 4px;
    height: 15.4px;
    line-height: 1.1;
    text-align: left;
    overflow: hidden;
    white-space: nowrap;
  }
  .notas th { font-weight: 700; }
  .notas td.n { text-align: right; }
  .notas + .notas { margin-top: 9px; }
  .cabec + .notas { margin-top: 0; }
  .w7 { width: 6.5%; } .w8 { width: 7.5%; } .w9 { width: 8.5%; }
  .w12 { width: 10%; } .w13 { width: 11.5%; } .wd { width: 49.5%; }

  .enade { margin-top: 26px; font-size: 8.8px; }
  .chleg { margin-top: 14px; font-size: 8.8px; }
  .diploma { margin-top: 6px; }
  .diploma td { border: 1px solid #1a1a1a; font-size: 8.8px; padding: 5px 8px; height: 20px; }
  .diploma .dl { border-right: 0; }
  .diploma .dr { border-left: 0; text-align: right; }
  .dg2 { margin-top: -1px; }
  .dg2 td { border-top: 0; }

  .assina { margin-top: 16px; font-size: 8.8px; line-height: 2.1; }
  .assina .nome { }

  .rodape { position: absolute; left: 46px; right: 46px; bottom: 26px; font-size: 7.6px; line-height: 1.7; color: #1a1a1a; }
</style>
</head>
<body>
${paginasHtml}
</body>
</html>`;
}

/* ---------------------------------------------------------------- serve */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const keys = [
      "cidade_uf", "faculdade", "endereco_faculdade",
      "nome", "ra", "natural_estado", "nascimento", "doc_identidade", "nacionalidade",
      "titulacao", "ingresso", "classificacao", "curso", "regime", "portaria",
      "enade_texto", "diploma_curso", "carga_horaria", "data_colacao", "data_expedicao",
      "local_data", "secretaria_nome", "secretaria_cargo", "codigo_documento", "site_validacao",
    ];

    const data: Record<string, string> = {
      logo_base64: typeof body.logo_base64 === "string" ? body.logo_base64 : "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const grupos: LinhaHistorico[][] = Array.isArray(body.grupos)
      ? (body.grupos as LinhaHistorico[][]).filter((g) => Array.isArray(g) && g.length)
      : [];

    const html = buildAnhangueraHistoricoHtml(data, grupos);

    return new Response(JSON.stringify({ success: true, render: "browser", html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating Histórico Superior:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
