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

/** Nota de uma disciplina: 9 colunas (1º ano até 9º ano/8ª série). */
type Nota = { componente: string; base: string; n: string[] };
type Etapa = { etapa: string; ano: string; unidade: string; cidade: string; uf: string };
type Dependencia = {
  serie: string; componente: string; ch: string; nota: string;
  freq: string; escola: string; cidade: string; ano: string;
};

export const COLUNAS_SERIE = ["1º", "2º/1ª", "3º/2ª", "4º/3ª", "5º/4ª", "6º/5ª", "7º/6ª", "8º/7ª", "9º/8ª"];

function parseList<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Normaliza a linha de notas para exatamente 9 colunas, usando "*" quando vazio. */
export function normalizarNotas(nota: Nota): string[] {
  const base = Array.isArray(nota.n) ? nota.n : [];
  return COLUNAS_SERIE.map((_, i) => {
    const v = String(base[i] ?? "").trim();
    return v || "*";
  });
}

/** Normaliza uma linha de rodapé (frequência/CH/resultado) para 9 colunas. */
export function normalizarLinha(valores: string[] | undefined): string[] {
  const base = Array.isArray(valores) ? valores : [];
  return COLUNAS_SERIE.map((_, i) => {
    const v = String(base[i] ?? "").trim();
    return v || "*";
  });
}

export function buildHistoricoFundamentalHtml(d: Record<string, string>) {
  const brasao = d.template_brasao_base64 || "";
  const assinatura = d.assinatura_base64 || "";
  const notas = parseList<Nota>(d.notas_json);
  const etapas = parseList<Etapa>(d.etapas_json);
  const dependencias = parseList<Dependencia>(d.dependencias_json);
  const frequencia = normalizarLinha(parseList<string>(d.frequencia_json));
  const cargaHoraria = normalizarLinha(parseList<string>(d.carga_horaria_json));
  const resultado = normalizarLinha(parseList<string>(d.resultado_json));
  const t = (v: unknown) => escapeHtml(String(v ?? "").trim());

  const cabecalhoSeries = COLUNAS_SERIE.map((s) => `<th class="head sm">${escapeHtml(s)}</th>`).join("");

  const linhasNotas = notas
    .map((nota) => {
      const cells = normalizarNotas(nota).map((v) => `<td class="nota">${t(v)}</td>`).join("");
      return `<tr><td class="comp">${t(nota.componente)}</td><td class="base">${t(nota.base) || "COMUM"}</td>${cells}</tr>`;
    })
    .join("");

  const linhaRodape = (rotulo: string, valores: string[]) =>
    `<tr><td class="tot" colspan="2">${escapeHtml(rotulo)}</td>${valores
      .map((v) => `<td class="nota">${t(v)}</td>`)
      .join("")}</tr>`;

  const linhasEtapas = etapas
    .map(
      (e) =>
        `<tr><td class="c">${t(e.etapa)}</td><td class="c">${t(e.ano)}</td>` +
        `<td>${t(e.unidade)}</td><td class="c">${t(e.cidade)}</td><td class="c">${t(e.uf)}</td></tr>`,
    )
    .join("");

  const linhasDependencia = dependencias
    .map(
      (dep) =>
        `<tr><td class="c">${t(dep.serie) || "-"}</td><td>${t(dep.componente) || "-"}</td>` +
        `<td class="c">${t(dep.ch) || "-"}</td><td class="c">${t(dep.nota) || "-"}</td>` +
        `<td class="c">${t(dep.freq) || "-"}</td><td>${t(dep.escola) || "-"}</td>` +
        `<td class="c">${t(dep.cidade) || "-"}</td><td class="c">${t(dep.ano) || "-"}</td></tr>`,
    )
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
    font-family: 'Times New Roman', 'Liberation Serif', serif;
    color: #000;
  }
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; padding: 26px 30px; }
  .topo { display: flex; gap: 12px; align-items: flex-start; }
  .topo img.brasao { width: 72px; height: 72px; object-fit: contain; }
  .escola { flex: 1; font-family: Arial, sans-serif; font-size: 10.5px; line-height: 1.45; }
  .escola .forte { font-weight: bold; }
  .titulo { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 13px; margin-top: 10px; }
  .subtitulo { text-align: center; font-family: Arial, sans-serif; font-size: 10.5px; margin-top: 2px; }
  .aluno { margin-top: 10px; font-size: 11px; line-height: 1.65; }
  .aluno .row { display: flex; justify-content: space-between; gap: 12px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .grade { margin-top: 10px; }
  .grade th, .grade td { border: 1px solid #000; padding: 1.5px 3px; font-size: 9.5px; }
  .grade .head { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 9px; line-height: 1.15; }
  .grade .head.sm { font-size: 8.5px; font-weight: normal; }
  .grade .comp { font-size: 9.5px; }
  .grade .base { font-family: Arial, sans-serif; font-size: 7.5px; text-align: center; }
  .grade .nota { text-align: center; font-size: 9.5px; }
  .grade .tot { font-family: Arial, sans-serif; font-size: 8.5px; font-weight: bold; }
  .etapas { margin-top: 12px; }
  .etapas th, .etapas td { border: 1px solid #000; padding: 2px 4px; font-size: 9.5px; }
  .etapas th { font-family: Arial, sans-serif; font-weight: bold; text-align: center; font-size: 9px; }
  .etapas .c { text-align: center; }
  .obs { margin-top: 10px; font-family: Arial, sans-serif; font-size: 9px; line-height: 1.4; text-align: justify; }
  .assinaturas { margin-top: 34px; display: flex; justify-content: space-around; gap: 16px; position: relative; }
  .assin { flex: 1; text-align: center; font-family: Arial, sans-serif; font-size: 9.5px; line-height: 1.45; }
  .assin .nome { font-weight: bold; font-size: 10px; }
  .assin .linha { border-top: 1px solid #000; margin: 0 8px 3px; }
  .carimbo { position: absolute; left: 0; right: 0; bottom: 8px; height: 78px; pointer-events: none; }
  .carimbo img { width: 100%; height: 100%; object-fit: contain; }
  .p2-titulo { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 13px; margin-bottom: 8px; }
  .dep th, .dep td { border: 1px solid #000; padding: 3px 4px; font-size: 9.5px; }
  .dep th { font-family: Arial, sans-serif; font-weight: bold; text-align: center; font-size: 8.5px; }
  .dep .c { text-align: center; }
  .rodape-assin { margin-top: 60px; display: flex; justify-content: space-around; gap: 24px; font-family: Arial, sans-serif; font-size: 10px; }
  .rodape-assin div { flex: 1; text-align: center; }
  .rodape-assin .linha { border-top: 1px solid #000; margin-bottom: 4px; }
</style>
</head>
<body>
<div class="page">
  <div class="topo">
    ${brasao ? `<img class="brasao" src="${escapeHtml(brasao)}" />` : ""}
    <div class="escola">
      <div class="forte">GOVERNO DO ESTADO DE ${t((d.estado_nome || "").toUpperCase())} — SECRETARIA DE ESTADO DA EDUCAÇÃO</div>
      <div>${t(d.gerencia)}</div>
      <div class="forte">${t(d.escola)}</div>
      <div>ENDEREÇO: ${t(d.endereco)}</div>
      <div>CEP: ${t(d.cep)} – Fone: ${t(d.telefone)} – INEP: ${t(d.inep)}</div>
    </div>
  </div>

  <div class="titulo">HISTÓRICO ESCOLAR – ENSINO FUNDAMENTAL</div>
  <div class="subtitulo">${t(d.modalidade || "ENSINO REGULAR")}${d.turno ? ` – TURNO: ${t(d.turno)}` : ""}</div>

  <div class="aluno">
    <div class="row"><span>Nome do Aluno: <b>${t(d.nome_aluno)}</b></span><span>R.G.: ${t(d.rg)}</span></div>
    <div class="row"><span>Filiação: ${t(d.filiacao)}</span></div>
    <div class="row"><span>Nascimento — Município: ${t(d.municipio_nascimento)}</span><span>Estado: ${t(d.uf_nascimento)}</span><span>País: ${t(d.pais || "BRASIL")}</span><span>Data: ${t(d.data_nascimento)}</span></div>
  </div>

  <table class="grade">
    <colgroup>
      <col><col style="width:66px">
      ${COLUNAS_SERIE.map(() => `<col style="width:44px">`).join("")}
    </colgroup>
    <tr>
      <th class="head" colspan="2">COMPONENTES CURRICULARES</th>
      <th class="head" colspan="9">ANOS / SÉRIES</th>
    </tr>
    <tr>
      <th class="head">DISCIPLINAS</th>
      <th class="head">BASE NACIONAL</th>
      ${cabecalhoSeries}
    </tr>
    ${linhasNotas}
    ${linhaRodape("FREQUÊNCIA ANUAL %", frequencia)}
    ${linhaRodape("CARGA HORÁRIA ANUAL", cargaHoraria)}
    ${linhaRodape("RESULTADO FINAL", resultado)}
  </table>

  <table class="etapas">
    <colgroup><col style="width:110px"><col style="width:60px"><col><col style="width:150px"><col style="width:36px"></colgroup>
    <tr><th>ETAPAS</th><th>ANO</th><th>ESTABELECIMENTO DE ENSINO</th><th>CIDADE</th><th>UF</th></tr>
    ${linhasEtapas}
  </table>

  <div class="obs">OBSERVAÇÕES: ${t(d.observacoes || "AP - APROVADO / * - DISCIPLINA NÃO CURSADA NA SÉRIE.")}</div>

  <div class="assinaturas">
    <div class="assin">
      <div class="linha"></div>
      <div class="nome">${t(d.secretario_nome)}</div>
      <div>Secretária Escolar</div>
      <div>${t(d.secretario_portaria)}</div>
    </div>
    <div class="assin">
      <div class="linha"></div>
      <div class="nome">${t(d.diretor_nome)}</div>
      <div>Diretor Escolar</div>
      <div>${t(d.diretor_portaria)}</div>
      <div>${t(d.diretor_registro)}</div>
    </div>
    ${assinatura ? `<div class="carimbo"><img src="${escapeHtml(assinatura)}" /></div>` : ""}
  </div>
</div>

<div class="page">
  <div class="p2-titulo">DEPENDÊNCIA DE ESTUDOS</div>
  <table class="dep">
    <colgroup><col style="width:52px"><col><col style="width:44px"><col style="width:44px"><col style="width:62px"><col style="width:150px"><col style="width:96px"><col style="width:48px"></colgroup>
    <tr>
      <th>SÉRIE</th><th>COMPONENTES CURRICULARES</th><th>CH</th><th>NOTA</th>
      <th>FREQ. ANUAL%</th><th>ESCOLA</th><th>CIDADE/UF</th><th>ANO</th>
    </tr>
    ${linhasDependencia}
  </table>

  <div class="obs"><b>OBSERVAÇÃO:</b> ${t(d.observacao_pagina2 || "Documento transcrito de acordo com o original arquivado na pasta do aluno neste Estabelecimento de Ensino.")}</div>

  <div class="rodape-assin">
    <div><div class="linha"></div>SECRETÁRIO (A)</div>
    <div><div class="linha"></div>DIRETOR (A)</div>
  </div>
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await authenticateRequest(req, corsHeaders);
  if (authResult instanceof Response) return authResult;

  try {
    const body = await req.json();

    const keys = [
      "estado", "estado_nome", "gerencia", "escola", "endereco", "cep", "telefone", "inep",
      "modalidade", "turno",
      "nome_aluno", "rg", "filiacao", "municipio_nascimento", "uf_nascimento", "pais", "data_nascimento",
      "observacoes", "observacao_pagina2",
      "secretario_nome", "secretario_portaria", "diretor_nome", "diretor_portaria", "diretor_registro",
      "notas_json", "etapas_json", "dependencias_json",
      "frequencia_json", "carga_horaria_json", "resultado_json",
      "template_brasao_base64", "assinatura_base64",
    ];

    const data: Record<string, string> = {};
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildHistoricoFundamentalHtml(data);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Histórico Ensino Fundamental:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
