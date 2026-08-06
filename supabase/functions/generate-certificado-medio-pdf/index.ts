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

export interface DisciplinaLinha {
  nome: string;
  n1?: string;
  c1?: string;
  n2?: string;
  c2?: string;
  n3?: string;
  c3?: string;
}

export interface EstabLinha {
  serie: string;
  ano?: string;
  estab?: string;
  cidade?: string;
  situacao?: string;
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Texto do certificado (parágrafo do topo). */
export function buildCertificadoMedioText(d: Record<string, string>): string {
  const nome = (d.nome_aluno || "").trim();
  const mae = (d.mae || "").trim();
  const pai = (d.pai || "").trim();
  const filiacao = pai ? `${mae} e ${pai}` : mae;
  const filho = (d.sexo || "M") === "F" ? "filha" : "filho";
  return (
    `Certifico que <b>${escapeHtml(nome)}</b> , ${filho} de ${escapeHtml(filiacao)}, nascido em ${escapeHtml(d.data_nasc || "")}, ` +
    `natural de ${escapeHtml(d.municipio_nasc || "")} , UF ${escapeHtml(d.uf_nasc || "")} , nacionalidade ${escapeHtml(d.nacionalidade || "BRASILEIRA")} , ` +
    `RG ${escapeHtml(d.rg || "")} órgão expedidor ${escapeHtml(d.orgao_expedidor || "")} , concluiu o ${escapeHtml(d.serie_conclusao || "3º Ano")} do Ensino Médio ` +
    `no ano letivo de ${escapeHtml(d.ano_conclusao || "")}, de acordo com a Lei Federal de Diretrizes e Bases da Educação Nacional nº 9394/96 vigente no país ` +
    `e com Regimento Escolar deste Estabelecimento de Ensino.`
  );
}

export function buildCertificadoMedioHtml(
  d: Record<string, string>,
  disciplinasComum: DisciplinaLinha[],
  disciplinasDiv: DisciplinaLinha[],
  estabs: EstabLinha[],
) {
  const linha = (l: DisciplinaLinha) => {
    const total = num(l.c1) + num(l.c2) + num(l.c3);
    return `<tr>
      <td class="disc">${escapeHtml(l.nome)}</td>
      <td></td><td class="c">${escapeHtml(l.n1 || "")}</td><td class="c">${escapeHtml(l.c1 || "")}</td>
      <td></td><td class="c">${escapeHtml(l.n2 || "")}</td><td class="c">${escapeHtml(l.c2 || "")}</td>
      <td></td><td class="c">${escapeHtml(l.n3 || "")}</td><td class="c">${escapeHtml(l.c3 || "")}</td>
      <td class="c">${total || 0}</td>
    </tr>`;
  };

  const todas = [...disciplinasComum, ...disciplinasDiv];
  const soma = (k: "c1" | "c2" | "c3") => todas.reduce((acc, l) => acc + num(l[k]), 0);
  const t1 = soma("c1");
  const t2 = soma("c2");
  const t3 = soma("c3");

  const dispensaSim = (d.dispensa_ed_fisica || "NAO") === "SIM";

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
    font-family: Arial, 'Liberation Sans', Helvetica, sans-serif;
    color: #000;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; padding: 34px 38px; }
  .head { display: flex; align-items: flex-start; gap: 10px; }
  .brasao { width: 66px; height: 76px; flex: 0 0 66px; }
  .brasao img { width: 100%; height: 100%; object-fit: contain; }
  .head-txt { flex: 1; text-align: center; line-height: 1.28; }
  .head-txt .l1 { font-size: 11.5px; font-weight: 700; }
  .head-txt .l2 { font-size: 10.5px; font-weight: 700; }
  .head-txt .l3 { font-size: 11px; font-weight: 700; }
  .head-txt .sm { font-size: 8.6px; }
  .titulo { text-align: center; font-size: 13px; font-weight: 700; margin: 22px 0 16px; }
  .cert { font-size: 10.4px; line-height: 1.5; text-align: justify; }
  table { width: 100%; border-collapse: collapse; }
  .notas { margin-top: 18px; }
  .notas th, .notas td { border: 1px solid #000; font-size: 8.6px; padding: 2px 3px; height: 15px; }
  .notas th { font-weight: 700; text-align: center; }
  .notas td.disc { text-align: left; }
  .notas td.c { text-align: center; }
  .grupo { font-weight: 700; text-align: left !important; }
  .totais td { font-weight: 700; text-align: center; }
  .sec { margin-top: 16px; font-size: 9.2px; font-weight: 700; }
  .estab th, .estab td, .prog th, .prog td { border: 1px solid #000; font-size: 8.6px; padding: 3px; height: 17px; text-align: center; }
  .estab, .prog { margin-top: 3px; }
  .linha-info { margin-top: 16px; font-size: 9.4px; }
  .box { display: inline-block; width: 14px; height: 11px; border: 1px solid #000; vertical-align: middle; text-align: center; font-size: 9px; line-height: 10px; margin: 0 6px; }
  .obs { margin-top: 14px; border: 1px solid #000; height: 74px; font-size: 9px; padding: 3px 5px; }
  .local { margin-top: 26px; text-align: center; font-size: 10px; }
  .assinaturas { margin-top: 46px; display: flex; justify-content: space-between; font-size: 9.4px; text-align: center; }
  .assinaturas div { width: 210px; }
  .rule { border-top: 1px solid #000; margin-bottom: 3px; }
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <div class="brasao">${d.brasao_base64 ? `<img src="${escapeHtml(d.brasao_base64)}" />` : ""}</div>
    <div class="head-txt">
      <div class="l1">${escapeHtml(d.gov_estado || "")}</div>
      <div class="l2">${escapeHtml(d.secretaria || "")}</div>
      <div class="l3">${escapeHtml((d.escola || "").toUpperCase())}</div>
      <div class="sm">${escapeHtml(d.endereco || "")}</div>
      <div class="sm">${escapeHtml(d.contato || "")}</div>
      <div class="sm">${escapeHtml(d.portaria || "")}</div>
    </div>
    <div class="brasao"></div>
  </div>

  <div class="titulo">CERTIFICADO E HISTÓRICO ESCOLAR – ENSINO MÉDIO</div>

  <div class="cert">${buildCertificadoMedioText(d)}</div>

  <table class="notas">
    <thead>
      <tr>
        <th rowspan="2" style="width:32%">DISCIPLINA</th>
        <th colspan="3">1º Ano (${escapeHtml(d.turma1 || "")})</th>
        <th colspan="3">2º Ano (${escapeHtml(d.turma2 || "")})</th>
        <th colspan="3">3 º Ano (${escapeHtml(d.turma3 || "")})</th>
        <th rowspan="2" style="width:9%">CH<br/>Total</th>
      </tr>
      <tr>
        <th>%</th><th>Nota</th><th>CH</th>
        <th>%</th><th>Nota</th><th>CH</th>
        <th>%</th><th>Nota</th><th>CH</th>
      </tr>
    </thead>
    <tbody>
      <tr><td class="grupo" colspan="11">Base Nacional Comum</td></tr>
      ${disciplinasComum.map(linha).join("")}
      <tr><td class="grupo" colspan="11">Base diversificada</td></tr>
      ${disciplinasDiv.map(linha).join("")}
      <tr class="totais">
        <td class="grupo">Carga Horária Total</td>
        <td colspan="3">${t1}</td>
        <td colspan="3">${t2}</td>
        <td colspan="3">${t3}</td>
        <td>${t1 + t2 + t3}</td>
      </tr>
    </tbody>
  </table>

  <div class="sec">Estabelecimento de Ensino</div>
  <table class="estab">
    <tr>
      <th style="width:8%">Série</th><th style="width:10%">Ano</th>
      <th style="width:44%">Nome do Estabelecimento</th>
      <th style="width:20%">Cidade/Estado</th><th style="width:18%">Situação</th>
    </tr>
    ${estabs
      .map(
        (e) => `<tr>
      <td>${escapeHtml(e.serie)}</td>
      <td>${escapeHtml(e.ano || "")}</td>
      <td>${escapeHtml(e.estab || "")}</td>
      <td>${escapeHtml(e.cidade || "")}</td>
      <td>${escapeHtml(e.situacao || "")}</td>
    </tr>`,
      )
      .join("")}
  </table>

  <div class="sec">Resultados de progressão Parcial</div>
  <table class="prog">
    <tr>
      <th style="width:22%">Disciplina</th><th style="width:8%">Série</th><th style="width:10%">Ano</th>
      <th style="width:7%">%</th><th style="width:8%">Nota</th><th style="width:15%">Resultado</th>
      <th style="width:30%">Nome do estabelecimento</th>
    </tr>
    <tr><td>${escapeHtml(d.pp_disciplina || "")}</td><td>${escapeHtml(d.pp_serie || "")}</td><td>${escapeHtml(d.pp_ano || "")}</td><td></td><td>${escapeHtml(d.pp_nota || "")}</td><td>${escapeHtml(d.pp_resultado || "")}</td><td>${escapeHtml(d.pp_estab || "")}</td></tr>
  </table>

  <div class="linha-info">
    Dispensa de Educação Física : Sim <span class="box">${dispensaSim ? "X" : ""}</span>
    Não <span class="box">${dispensaSim ? "" : "X"}</span>
  </div>
  <div class="linha-info">Base Legal ${escapeHtml(d.base_legal || "")}</div>

  <div class="obs">Observações: ${escapeHtml(d.observacoes || "")}</div>

  <div class="local">${escapeHtml(d.local_data || "")}</div>

  <div class="assinaturas">
    <div><div class="rule"></div>Secretario(a)</div>
    <div><div class="rule"></div>Diretor (a)</div>
  </div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const keys = [
      "uf", "gov_estado", "secretaria", "escola", "endereco", "contato", "portaria",
      "nome_aluno", "mae", "pai", "sexo", "data_nasc", "municipio_nasc", "uf_nasc",
      "nacionalidade", "rg", "orgao_expedidor", "serie_conclusao", "ano_conclusao",
      "turma1", "turma2", "turma3",
      "pp_disciplina", "pp_serie", "pp_ano", "pp_nota", "pp_resultado", "pp_estab",
      "dispensa_ed_fisica", "base_legal", "observacoes", "local_data",
    ];

    const data: Record<string, string> = {
      brasao_base64: typeof body.brasao_base64 === "string" ? body.brasao_base64 : "",
    };
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const comum: DisciplinaLinha[] = Array.isArray(body.disciplinas_comum) ? body.disciplinas_comum : [];
    const div: DisciplinaLinha[] = Array.isArray(body.disciplinas_diversificada) ? body.disciplinas_diversificada : [];
    const estabs: EstabLinha[] = Array.isArray(body.estabelecimentos) ? body.estabelecimentos : [];

    const html = buildCertificadoMedioHtml(data, comum, div, estabs);

    return new Response(JSON.stringify({ success: true, render: "browser", html }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error generating Certificado/Histórico Médio:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
