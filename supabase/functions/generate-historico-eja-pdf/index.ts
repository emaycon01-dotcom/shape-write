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

type Nota = { area: string; componente: string; n1: string; n2: string; n3: string; ch: string };
type Estudo = { nivel: string; termo: string; ano: string; unidade: string; municipio: string; uf: string };

function parseList<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Agrupa componentes por área do conhecimento preservando a ordem informada. */
export function agruparPorArea(notas: Nota[]): { area: string; itens: Nota[] }[] {
  const grupos: { area: string; itens: Nota[] }[] = [];
  for (const nota of notas) {
    const area = (nota.area || "").trim();
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.area === area) ultimo.itens.push(nota);
    else grupos.push({ area, itens: [nota] });
  }
  return grupos;
}

/** Soma as cargas horárias informadas (aceita vírgula ou ponto). */
export function somarCargaHoraria(notas: Nota[]): number {
  return notas.reduce((total, nota) => {
    const valor = Number(String(nota.ch || "").replace(",", "."));
    return Number.isFinite(valor) ? total + valor : total;
  }, 0);
}

export function buildHistoricoEjaHtml(d: Record<string, string>) {
  const brasao = d.template_brasao_base64 || "";
  const assinatura = d.assinatura_base64 || "";
  const notas = parseList<Nota>(d.notas_json);
  const estudos = parseList<Estudo>(d.estudos_json);
  const grupos = agruparPorArea(notas);
  const t = (v: unknown) => escapeHtml(String(v ?? "").trim());

  const totalBase = d.ch_base || String(somarCargaHoraria(notas) || "");
  const totalGeral =
    d.ch_total ||
    String(
      (Number(totalBase) || 0) + (Number(String(d.ch_diversificada || "").replace(",", ".")) || 0),
    );

  const linhasNotas = grupos
    .map((grupo) =>
      grupo.itens
        .map((item, index) => {
          const areaCell =
            index === 0
              ? `<td class="area" rowspan="${grupo.itens.length}"><span>${t(grupo.area)}</span></td>`
              : "";
          return `<tr>${areaCell}<td class="comp">${t(item.componente)}</td>` +
            `<td class="nota">${t(item.n1) || "–"}</td>` +
            `<td class="nota">${t(item.n2) || "–"}</td>` +
            `<td class="nota">${t(item.n3) || "–"}</td>` +
            `<td class="nota">${t(item.ch) || "–"}</td></tr>`;
        })
        .join(""),
    )
    .join("");

  const linhasEstudos = estudos
    .map(
      (estudo) =>
        `<tr><td class="c">${t(estudo.nivel)}</td><td class="c">${t(estudo.termo)}</td>` +
        `<td class="c">${t(estudo.ano)}</td><td>${t(estudo.unidade)}</td>` +
        `<td class="c">${t(estudo.municipio)}</td><td class="c">${t(estudo.uf)}</td></tr>`,
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
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; padding: 24px 30px; }
  .topo { display: flex; gap: 12px; align-items: flex-start; }
  .topo img.brasao { width: 74px; height: 74px; object-fit: contain; }
  .escola { flex: 1; font-family: Arial, sans-serif; font-size: 10.5px; line-height: 1.45; }
  .escola .forte { font-weight: bold; }
  .titulo { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 12.5px; margin-top: 10px; line-height: 1.35; }
  .subtitulo { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 11px; }
  .aluno { margin-top: 10px; font-size: 11.5px; line-height: 1.7; }
  .aluno .row { display: flex; justify-content: space-between; gap: 14px; }
  .corpo { display: flex; gap: 6px; margin-top: 10px; }
  .legal {
    width: 26px; border: 1px solid #000; position: relative;
    font-family: Arial, sans-serif; font-size: 8.5px; line-height: 1.35;
  }
  .legal span {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(180deg);
    writing-mode: vertical-rl; white-space: nowrap;
  }
  .grade-wrap { flex: 1; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .grade th, .grade td { border: 1px solid #000; padding: 1.5px 4px; font-size: 10.5px; }
  .grade .head { text-align: center; font-family: Arial, sans-serif; font-weight: normal; font-size: 10px; line-height: 1.2; }
  .grade .area { width: 26px; position: relative; height: 1px; }
  .grade .area span {
    display: block; writing-mode: vertical-rl; transform: rotate(180deg);
    margin: 0 auto; font-family: Arial, sans-serif; font-size: 8.5px; line-height: 1.2; white-space: nowrap;
  }
  .grade .comp { font-size: 10.5px; }
  .grade .nota { text-align: center; font-size: 10.5px; }
  .grade .tot { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; }
  .grade .divers { font-size: 10.5px; }
  .estudos { margin-top: 10px; }
  .estudos th, .estudos td { border: 1px solid #000; padding: 2px 4px; font-size: 10px; }
  .estudos th { font-family: Arial, sans-serif; font-weight: normal; text-align: center; }
  .estudos .c { text-align: center; }
  .obs { margin-top: 8px; font-family: Arial, sans-serif; font-size: 9.5px; }
  .gdae { margin-top: 12px; font-family: Arial, sans-serif; font-size: 10px; }
  .cert-titulo { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 12.5px; margin-top: 4px; }
  .cert-texto { margin-top: 4px; font-size: 11.5px; line-height: 1.6; text-align: justify; }
  .assinaturas { margin-top: 42px; display: flex; justify-content: space-between; gap: 10px; position: relative; }
  .assin { flex: 1; text-align: center; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; }
  .assin .nome { font-weight: bold; font-size: 10.5px; }
  .assin .rot { font-size: 9.5px; }
  .carimbo { position: absolute; left: 0; right: 0; bottom: 30px; height: 74px; pointer-events: none; }
  .carimbo img { width: 100%; height: 100%; object-fit: contain; }
</style>
</head>
<body>
<div class="page">
  <div class="topo">
    ${brasao ? `<img class="brasao" src="${escapeHtml(brasao)}" />` : ""}
    <div class="escola">
      <div class="forte">GOVERNO DO ESTADO DE ${t((d.estado_nome || "").toUpperCase())} — SECRETARIA DE ESTADO DA EDUCAÇÃO</div>
      <div>${t(d.coordenadoria)}</div>
      <div>DIRETORIA DE ENSINO – ${t(d.diretoria)}</div>
      <div class="forte">${t(d.escola)}</div>
      <div>ENDEREÇO: ${t(d.endereco)}</div>
      <div>CEP: ${t(d.cep)} – Fone: ${t(d.telefone)}</div>
    </div>
  </div>

  <div class="titulo">HISTÓRICO ESCOLAR – ENSINO MÉDIO – EDUCAÇÃO DE JOVENS E ADULTOS</div>
  <div class="subtitulo">${t(d.modalidade || "PRESENCIAL - NOTURNO")}</div>

  <div class="aluno">
    <div class="row"><span>Nome do Aluno: <b>${t(d.nome_aluno)}</b></span><span>R.G.: ${t(d.rg)}</span></div>
    <div class="row"><span>Nascimento — Município: ${t(d.municipio_nascimento)}</span><span>Estado: ${t(d.uf_nascimento)}</span><span>País: ${t(d.pais || "BRASIL")}</span><span>Data: ${t(d.data_nascimento)}</span></div>
  </div>

  <div class="corpo">
    <div class="legal"><span>${t(d.fundamento_legal)}</span></div>
    <div class="grade-wrap">
      <table class="grade">
        <colgroup><col style="width:26px"><col><col style="width:52px"><col style="width:52px"><col style="width:52px"><col style="width:62px"></colgroup>
        <tr>
          <th class="head" rowspan="2" colspan="2">COMPONENTES CURRICULARES</th>
          <th class="head" colspan="3">Período Letivo</th>
          <th class="head" rowspan="2">Carga<br/>Horária</th>
        </tr>
        <tr>
          <th class="head">1º Termo<br/>Ano</th>
          <th class="head">2º Termo<br/>Ano</th>
          <th class="head">3º Termo<br/>Ano</th>
        </tr>
        ${linhasNotas}
        <tr><td class="tot" colspan="5">CARGA HORÁRIA – Base Nacional Comum</td><td class="nota">${t(totalBase) || "–"}</td></tr>
        <tr><td class="divers" colspan="6">Disciplina de Apoio Curricular: ${t(d.apoio_curricular)}</td></tr>
        <tr><td class="tot" colspan="5">CARGA HORÁRIA – Parte Diversificada</td><td class="nota">${t(d.ch_diversificada) || "–"}</td></tr>
        <tr><td class="tot" colspan="5">TOTAL DE CARGA HORÁRIA – Base Nacional Comum e Parte Diversificada</td><td class="nota">${t(totalGeral) || "–"}</td></tr>
      </table>
    </div>
  </div>

  <table class="estudos">
    <colgroup><col style="width:120px"><col style="width:78px"><col style="width:52px"><col><col style="width:130px"><col style="width:34px"></colgroup>
    <tr><th colspan="6" style="font-weight:bold">ESTUDOS REALIZADOS</th></tr>
    <tr><th>Ensino</th><th>Série/Termo</th><th>Ano</th><th>Estabelecimento de Ensino</th><th>Município</th><th>UF</th></tr>
    ${linhasEstudos}
  </table>

  <div class="obs">OBSERVAÇÕES: ${t(d.observacoes || "DT - DISPENSA POR LEI N° 10.793/2003")}</div>

  <div class="gdae">N° de Concluinte GDAE: ${t(d.gdae)}</div>
  <div class="cert-titulo">CERTIFICADO</div>
  <div class="cert-texto">
    O Diretor da ${t(d.escola)} CERTIFICA, nos termos do Inciso VII, Artigo 24 da Lei Federal
    9394/96, que <b>${t(d.nome_aluno)}</b>, R.G. ${t(d.rg)}, concluiu o Ensino Médio – Educação de Jovens e Adultos,
    no ano de ${t(d.ano_conclusao)}.
  </div>

  <div class="assinaturas">
    <div class="assin">
      <div class="nome">${t(d.data_certificado)}</div>
      <div class="rot">DATA</div>
    </div>
    <div class="assin">
      <div class="nome">${t(d.secretario_nome)}</div>
      <div class="rot">Nome do Secretário</div>
      <div class="rot">R.G.: ${t(d.secretario_rg)}</div>
    </div>
    <div class="assin">
      <div class="nome">${t(d.diretor_nome)}</div>
      <div class="rot">Nome do Diretor</div>
      <div class="rot">R.G.: ${t(d.diretor_rg)}</div>
    </div>
    ${assinatura ? `<div class="carimbo"><img src="${escapeHtml(assinatura)}" /></div>` : ""}
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
      "estado", "estado_nome", "coordenadoria", "diretoria", "escola", "endereco", "cep", "telefone",
      "modalidade", "fundamento_legal",
      "nome_aluno", "rg", "municipio_nascimento", "uf_nascimento", "pais", "data_nascimento",
      "apoio_curricular", "ch_base", "ch_diversificada", "ch_total",
      "observacoes", "gdae", "ano_conclusao", "data_certificado",
      "secretario_nome", "secretario_rg", "diretor_nome", "diretor_rg",
      "notas_json", "estudos_json",
      "template_brasao_base64", "assinatura_base64",
    ];

    const data: Record<string, string> = {};
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildHistoricoEjaHtml(data);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Histórico/Certificado EJA:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
