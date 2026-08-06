import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export interface Ficha19Disciplina {
  nome: string;
  p1?: string; n1?: string; c1?: string;
  p2?: string; n2?: string; c2?: string;
  p3?: string; n3?: string; c3?: string;
}

export interface Ficha19Progressao {
  ano?: string;
  serie?: string;
  disciplina?: string;
  percentual?: string;
  nota?: string;
  unidade?: string;
}

/** Número de linhas da tabela de notas (fixo, como no impresso). */
const LINHAS_NOTAS = 22;
const LINHAS_PROGRESSAO = 6;

const box = (marcado: boolean) =>
  `<span class="chk">${marcado ? "x" : "&nbsp;"}</span>`;

/* --------------------------------------------------------------- página 1 */

function page1(d: Record<string, string>) {
  const eja = (d.eja || "NAO") === "SIM";
  const prog = (d.progressao_parcial || "NAO") === "SIM";
  const relig = (d.dispensa_religioso || "NAO") === "SIM";
  const edf = (d.dispensa_ed_fisica || "NAO") === "SIM";
  const filho = (d.sexo || "M") === "F" ? "Filha" : "Filho";
  const nacido = (d.sexo || "M") === "F" ? "Nascida" : "Nascido";

  const obsLinhas = Array.from({ length: 10 }, () => `<div class="rule"></div>`).join("");

  return `
<div class="page p1">
  <div class="head">
    <div class="brasao">${d.brasao_base64 ? `<img src="${esc(d.brasao_base64)}" />` : ""}</div>
    <div class="head-txt">
      <div class="h1">REPÚBLICA FEDERATIVA DO BRASIL</div>
      <div class="h2">${esc(d.gov_estado)}</div>
      <div class="h2">${esc(d.secretaria)}</div>
    </div>
  </div>

  <div class="escola-linha">${esc(d.escola)}${d.etapas ? ` &nbsp;-&nbsp; ${esc(d.etapas)}` : ""}</div>
  <div class="escola-label">Nome do Estabelecimento de Ensino</div>

  <table class="bx endereco">
    <tr>
      <td class="c" style="width:56%">
        <div class="val">${esc(d.endereco)}</div>
        <div class="lbl">Endereço</div>
      </td>
      <td class="c" style="width:26%">
        <div class="val">${esc(d.cidade)}</div>
        <div class="lbl">Cidade</div>
      </td>
      <td class="c" style="width:18%">
        <div class="val">${esc(d.uf)}</div>
        <div class="lbl">UF</div>
      </td>
    </tr>
  </table>

  <table class="bx atos">
    <tr>
      <td style="width:38%">Ato de Funcionamento – <b>${esc(d.ato_funcionamento)}</b></td>
      <td style="width:32%">Diário Oficial de: <b>${esc(d.diario_oficial)}</b></td>
      <td style="width:30%">Cadastro Escolar Nº: <b>${esc(d.cadastro_escolar)}</b></td>
    </tr>
  </table>

  <div class="bx cert">
    <div class="cert-tit">CERTIFICADO E HISTÓRICO ESCOLAR DO ENSINO MÉDIO</div>
    <div class="cert-l">Pelo presente Histórico escolar certificamos que <b>${esc(d.nome_aluno)}</b></div>
    <div class="cert-l">${filho} de&nbsp; <b>${esc(d.mae)}</b></div>
    <div class="cert-l">e de&nbsp; <b>${esc(d.pai || "N/A")}</b></div>
    <div class="cert-l">${nacido} em <b>${esc(d.data_nasc)}</b></div>
    <div class="cert-l">Cidade&nbsp; <b>${esc(d.municipio_nasc)}</b>&nbsp;&nbsp; UF <b>${esc(d.uf_nasc)}</b></div>
    <div class="cert-l">Nacionalidade <b>${esc(d.nacionalidade)}</b>&nbsp;&nbsp; RG <b>${esc(d.rg)}</b>
      <span class="rgt">Órgão Expedidor&nbsp; <b>${esc(d.orgao_expedidor)}</b></span></div>
    <div class="cert-l">Concluiu a: <b>${esc(d.serie_conclusao)}</b> ( &nbsp; ) série, &nbsp;do Ensino Médio, nos termos&nbsp; da Lei</div>
    <div class="cert-l">9.394/96 de 20 de dezembro de 1996, Título V, Capítulo II, Seção IV .</div>
  </div>

  <div class="bx info">
    <div class="info-tit">INFORMAÇÕES COMPLEMENTARES</div>
    <div class="il"><b>1.</b>&nbsp; Forma de Acesso:</div>
    <div class="il"><b>CLASSIFICAÇÃO:</b> Base Legal : Lei Federal 9.394/96, artigo 24, inciso II, alínea <span class="ul">${esc(d.alinea)}</span></div>
    <div class="il"><b>2.</b>&nbsp; Modalidade de Ensino: Educação de Jovens e Adultos:
      <span class="opt">${box(eja)} <b>SIM</b></span><span class="opt">${box(!eja)} <b>NÃO</b></span></div>
    <div class="il"><b>3.</b>&nbsp; Mínimo exigido para promoção é:&nbsp; 6&nbsp; e 75% de freqüência do total de horas letivas.</div>
    <div class="il"><b>4.</b>&nbsp; Progressão Parcial:
      <span class="opt">${box(prog)} <b>SIM</b></span><span class="opt">${box(!prog)} <b>NÃO</b></span>
      <span class="opt"><span class="chk">${esc(d.qtd_disciplinas) || "&nbsp;"}</span> <b>Nº de Disciplinas</b></span></div>
    <div class="il"><b>5.</b>&nbsp; Dispensa de Ensino Religioso:
      <span class="opt">${box(relig)} <b>SIM</b></span><span class="opt">${box(!relig)} <b>NÃO</b></span></div>
    <div class="il"><b>BASE LEGAL:</b> <span class="ul long">${esc(d.base_legal_religioso)}</span></div>
    <div class="il"><b>6.</b>&nbsp; Dispensa de Educação Física:
      <span class="opt">${box(edf)} <b>SIM</b></span><span class="opt">${box(!edf)} <b>NÃO</b></span></div>
    <div class="il"><b>BASE LEGAL:</b> <span class="ul long">${esc(d.base_legal_ed_fisica)}</span></div>
  </div>

  <div class="obs">
    <div class="obs-tit">Observações:</div>
    <div class="obs-txt">${esc(d.observacoes).replace(/\n/g, "<br/>")}</div>
    ${obsLinhas}
  </div>
</div>`;
}

/* --------------------------------------------------------------- página 2 */

function page2(
  d: Record<string, string>,
  discs: Ficha19Disciplina[],
  progs: Ficha19Progressao[],
) {
  const linhas = discs.slice(0, LINHAS_NOTAS);
  while (linhas.length < LINHAS_NOTAS) linhas.push({ nome: "" });

  const vert = (serie: string) => {
    const estab = serie === "1" ? d.estab1 : serie === "2" ? d.estab2 : d.estab3;
    const cidade = serie === "1" ? d.cidade1 : serie === "2" ? d.cidade2 : d.cidade3;
    const uf = serie === "1" ? d.uf1 : serie === "2" ? d.uf2 : d.uf3;
    return `<td class="vcell" rowspan="${LINHAS_NOTAS}">
      <div class="vtxt"><span class="vsmall">Estabelecimento</span> <b>${esc(estab)}</b>
      <span class="vsmall">Cidade</span> <b>${esc(cidade)}</b> <span class="vsmall">UF</span> <b>${esc(uf)}</b></div>
    </td>`;
  };

  const rowsHtml = linhas
    .map((l, i) => {
      const v1 = i === 0 ? vert("1") : "";
      const v2 = i === 0 ? vert("2") : "";
      const v3 = i === 0 ? vert("3") : "";
      return `<tr>
        <td class="disc">${esc(l.nome)}</td>
        <td class="c">${esc(l.p1 ?? (l.nome ? "-" : ""))}</td><td class="c">${esc(l.n1)}</td><td class="c">${esc(l.c1)}</td>${v1}
        <td class="c">${esc(l.p2 ?? (l.nome ? "-" : ""))}</td><td class="c">${esc(l.n2)}</td><td class="c">${esc(l.c2)}</td>${v2}
        <td class="c">${esc(l.p3 ?? (l.nome ? "-" : ""))}</td><td class="c">${esc(l.n3)}</td><td class="c">${esc(l.c3)}</td>${v3}
      </tr>`;
    })
    .join("");

  const ch = (k: "c1" | "c2" | "c3") =>
    discs.reduce((acc, l) => acc + num(l[k]), 0) || "";

  const progRows = (() => {
    const list = progs.slice(0, LINHAS_PROGRESSAO);
    while (list.length < LINHAS_PROGRESSAO) list.push({});
    return list
      .map(
        (p) => `<tr>
        <td>${esc(p.ano)}</td><td>${esc(p.serie)}</td><td>${esc(p.disciplina)}</td>
        <td>${esc(p.percentual || "-")}</td><td>${esc(p.nota || "-")}</td><td>${esc(p.unidade || "-")}</td>
      </tr>`,
      )
      .join("");
  })();

  const assinatura = (src: string) =>
    src ? `<img class="assin" src="${esc(src)}" />` : "";

  return `
<div class="page p2">
  <div class="p2-tit">HISTÓRICO ESCOLAR DO ENSINO MÉDIO</div>

  <table class="notas">
    <tr class="hdr-serie">
      <td class="disc-hdr" rowspan="3">COMPONENTES CURRICULARES</td>
      <td colspan="3">( &nbsp; ) 1ª SÉRIE</td>
      <td class="vhdr" rowspan="3"></td>
      <td colspan="3">( &nbsp; ) 2ª SÉRIE</td>
      <td class="vhdr" rowspan="3"></td>
      <td colspan="3">( &nbsp; ) 3ª SÉRIE</td>
      <td class="vhdr" rowspan="3"></td>
    </tr>
    <tr class="hdr-ano">
      <td colspan="3">ANO <span class="ano">${esc(d.ano1)}</span></td>
      <td colspan="3">ANO <span class="ano">${esc(d.ano2)}</span></td>
      <td colspan="3">ANO <span class="ano">${esc(d.ano3)}</span></td>
    </tr>
    <tr class="hdr-col">
      <td>%</td><td>Nota</td><td>CH</td>
      <td>%</td><td>Nota</td><td>CH</td>
      <td>%</td><td>Nota</td><td>CH</td>
    </tr>
    ${rowsHtml}
    <tr class="tot">
      <td class="disc it">CARGA HORÁRIA ANUAL</td>
      <td class="c" colspan="3">${ch("c1")}</td>
      <td class="c" colspan="3">${ch("c2")}</td>
      <td class="c" colspan="3">${ch("c3")}</td>
    </tr>
    <tr class="tot">
      <td class="disc">PERCENTUAL DE FREQÜÊNCIA ANUAL</td>
      <td class="c" colspan="3">${esc(d.freq1)}</td>
      <td class="c" colspan="3">${esc(d.freq2)}</td>
      <td class="c" colspan="3">${esc(d.freq3)}</td>
    </tr>
    <tr class="tot">
      <td class="disc">RESULTADO ANUAL</td>
      <td class="c" colspan="3">${esc(d.resultado1)}</td>
      <td class="c" colspan="3">${esc(d.resultado2)}</td>
      <td class="c" colspan="3">${esc(d.resultado3)}</td>
    </tr>
    <tr class="tot">
      <td class="disc">PARCIAL&nbsp;&nbsp;&nbsp; ESPECIAL</td>
      <td class="c" colspan="3">-</td>
      <td class="c" colspan="3">-</td>
      <td class="c" colspan="3">-</td>
    </tr>
  </table>

  <div class="prog-tit">REGISTRO DA PROGRESSÃO PARCIAL E EXAME ESPECIAL</div>
  <table class="prog">
    <tr class="hdr">
      <td style="width:8%">ANO</td><td style="width:10%">SÉRIE</td><td style="width:40%">DISCIPLINA</td>
      <td style="width:8%">%</td><td style="width:10%">NOTA</td><td style="width:24%">UNIDADE DE ENSINO</td>
    </tr>
    ${progRows}
  </table>

  <div class="local-data">${esc(d.local_data)}</div>

  <div class="assinaturas">
    <div class="col">
      <div class="assin-box">${assinatura(d.assinatura_secretario)}</div>
      <div class="linha"></div>
      <div class="cargo">Secretário - Registro ou Matrícula</div>
    </div>
    <div class="col">
      <div class="assin-box">${assinatura(d.assinatura_diretor)}</div>
      <div class="linha"></div>
      <div class="cargo">Diretor - Registro ou Matrícula</div>
    </div>
  </div>
</div>`;
}

/* ----------------------------------------------------------------- html */

export function buildFicha19Html(
  d: Record<string, string>,
  discs: Ficha19Disciplina[],
  progs: Ficha19Progressao[],
) {
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
    font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
    color: #000;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; }
  .p1 { padding: 28px 40px 24px; }
  .p2 { padding: 20px 32px 18px; }

  /* ---------------- página 1 ---------------- */
  .head { display: flex; align-items: center; gap: 10px; }
  .brasao { width: 72px; height: 60px; flex: 0 0 72px; }
  .brasao img { width: 100%; height: 100%; object-fit: contain; }
  .head-txt { flex: 1; text-align: center; }
  .head-txt .h1 { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
  .head-txt .h2 { font-size: 10.5px; font-weight: 700; }
  .escola-linha { margin-top: 10px; text-align: center; font-size: 11px; font-weight: 700; border-top: 1.4px solid #000; padding-top: 5px; }
  .escola-label { text-align: center; font-size: 9.5px; font-weight: 700; padding: 2px 0 4px; border-bottom: 1.4px solid #000; }

  table.bx { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.bx td { border: 1px solid #000; padding: 4px 8px; font-size: 10px; vertical-align: middle; }
  .endereco td { height: 52px; }
  .endereco .val { text-align: center; font-size: 10.5px; font-weight: 700; min-height: 15px; }
  .endereco .lbl { text-align: center; font-size: 9px; font-weight: 700; margin-top: 4px; }
  .atos td { height: 30px; font-size: 9.4px; font-weight: 700; }

  .bx.cert, .bx.info { border: 1px solid #000; margin-top: 10px; padding: 8px 10px; }
  .cert { min-height: 158px; }
  .cert-tit { text-align: center; font-size: 11px; font-weight: 700; margin-bottom: 10px; }
  .cert-l { font-size: 10.2px; line-height: 1.65; position: relative; }
  .cert-l .rgt { position: absolute; left: 340px; }
  .info-tit { text-align: center; font-size: 11px; font-weight: 700; margin-bottom: 8px; }
  .il { font-size: 9.8px; line-height: 1.55; margin-bottom: 7px; }
  .chk { display: inline-block; width: 15px; height: 12px; border: 1px solid #000; text-align: center; font-size: 9px; line-height: 11px; vertical-align: middle; }
  .opt { margin-left: 18px; white-space: nowrap; }
  .ul { display: inline-block; min-width: 90px; border-bottom: 1px solid #000; text-align: center; font-weight: 700; }
  .ul.long { min-width: 420px; }

  .obs { margin-top: 10px; }
  .obs-tit { font-size: 10px; font-weight: 700; }
  .obs-txt { font-size: 9.6px; min-height: 12px; }
  .rule { border-bottom: 1px solid #000; height: 17px; }

  /* ---------------- página 2 ---------------- */
  .p2-tit { text-align: center; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  table.notas { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.notas td { border: 1px solid #000; font-size: 7.4px; height: 17.6px; padding: 0 2px; text-align: center; }
  table.notas td.disc { text-align: left; font-weight: 700; font-size: 7px; }
  table.notas td.disc-hdr { font-size: 8px; font-weight: 400; width: 178px; }
  .hdr-serie td, .hdr-ano td, .hdr-col td { font-weight: 700; font-size: 8px; height: 20px; }
  .hdr-col td { font-size: 7.6px; }
  .ano { display: inline-block; min-width: 34px; border-bottom: 1px solid #000; }
  .vhdr { width: 26px; }
  .vcell { width: 26px; position: relative; padding: 0; }
  .vtxt {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%) rotate(-90deg);
    transform-origin: center center;
    white-space: nowrap; font-size: 7.6px; font-weight: 700;
    width: 380px; text-align: center;
  }
  .vsmall { font-size: 6.2px; font-weight: 400; }
  .tot td { font-weight: 700; font-size: 7.4px; }
  .tot td.it { font-style: italic; }

  .prog-tit { text-align: center; font-size: 8px; font-weight: 700; margin-top: 6px; }
  table.prog { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.prog td { border: 1px solid #000; font-size: 7px; height: 17.6px; text-align: center; }
  table.prog tr.hdr td { font-weight: 700; font-size: 6.6px; }

  .local-data { text-align: center; font-size: 9.4px; font-weight: 700; margin-top: 26px; }
  .assinaturas { display: flex; justify-content: space-between; margin-top: 6px; padding: 0 26px; }
  .assinaturas .col { width: 300px; text-align: center; position: relative; }
  .assin-box { height: 56px; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
  .assin { max-height: 56px; max-width: 260px; object-fit: contain; }
  .linha { border-bottom: 1px solid #000; }
  .cargo { font-size: 9px; font-weight: 700; margin-top: 4px; }
</style>
</head>
<body>
${page1(d)}
${page2(d, discs, progs)}
</body>
</html>`;
}

/* ---------------------------------------------------------------- serve */

const TEXT_KEYS = [
  "brasao_base64", "gov_estado", "secretaria", "escola", "etapas",
  "endereco", "cidade", "uf", "ato_funcionamento", "diario_oficial", "cadastro_escolar",
  "nome_aluno", "mae", "pai", "sexo", "data_nasc", "municipio_nasc", "uf_nasc",
  "nacionalidade", "rg", "orgao_expedidor", "serie_conclusao",
  "alinea", "eja", "progressao_parcial", "qtd_disciplinas", "dispensa_religioso",
  "base_legal_religioso", "dispensa_ed_fisica", "base_legal_ed_fisica", "observacoes",
  "ano1", "ano2", "ano3",
  "estab1", "estab2", "estab3", "cidade1", "cidade2", "cidade3", "uf1", "uf2", "uf3",
  "freq1", "freq2", "freq3", "resultado1", "resultado2", "resultado3",
  "local_data", "assinatura_secretario", "assinatura_diretor",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const data: Record<string, string> = {};
    for (const k of TEXT_KEYS) data[k] = typeof body[k] === "string" ? body[k] : "";

    const discs: Ficha19Disciplina[] = Array.isArray(body.disciplinas) ? body.disciplinas : [];
    const progs: Ficha19Progressao[] = Array.isArray(body.progressoes) ? body.progressoes : [];

    const html = buildFicha19Html(data, discs, progs);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Ficha 19:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
