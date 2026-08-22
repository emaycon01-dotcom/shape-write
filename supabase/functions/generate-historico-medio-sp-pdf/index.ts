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

type Nota = { area: string; componente: string; n1: string; n2: string; n3: string };
type Turma = { ano: string; serie: string; turno: string; unidade: string; municipio: string };

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

export function buildHistoricoMedioSpHtml(d: Record<string, string>) {
  const brasao = d.template_brasao_base64 || "";
  const assinatura = d.assinatura_base64 || "";
  const notas = parseList<Nota>(d.notas_json);
  const turmas = parseList<Turma>(d.turmas_json);
  const t = (v: unknown) => escapeHtml(String(v ?? "").trim());

  // Sem rowspan/colspan nem texto vertical: cada disciplina é uma linha simples
  // de quatro células, evitando coordenadas erradas no motor Canvas.
  const linhasNotas = notas
    .map((item) =>
      `<tr><td class="comp">${t(item.componente)}</td>` +
      `<td class="nota">${t(item.n1) || "-"}</td>` +
      `<td class="nota">${t(item.n2) || "-"}</td>` +
      `<td class="nota">${t(item.n3) || "-"}</td></tr>`,
    )
    .join("");

  const linhasTurmas = turmas
    .map(
      (turma) =>
        `<tr><td class="c">${t(turma.ano)}</td><td class="c">${t(turma.serie)}</td>` +
        `<td class="c">${t(turma.turno)}</td><td class="c">${t(turma.unidade)}</td>` +
        `<td class="c">${t(turma.municipio)}</td></tr>`,
    )
    .join("");

  const rodapeTotais = [
    ["Total da Carga Horária Anual", d.ch1, d.ch2, d.ch3],
    ["Total de Dias Letivos", d.dias1, d.dias2, d.dias3],
    ["% de Faltas Anual", d.faltas1, d.faltas2, d.faltas3],
    ["Resultado Final", d.resultado1, d.resultado2, d.resultado3],
  ]
    .map(
      ([rotulo, a, b, c]) =>
        `<tr><td class="tot">${t(rotulo)}</td><td class="nota">${t(a) || "-"}</td>` +
        `<td class="nota">${t(b) || "-"}</td><td class="nota">${t(c) || "-"}</td></tr>`,
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
  .page { width: 794px; height: 1123px; position: relative; background: #fff; overflow: hidden; padding: 26px 34px; }
  .brasao { text-align: center; }
  .brasao img { width: 92px; height: 92px; object-fit: contain; }
  .gov { text-align: center; font-family: Arial, sans-serif; font-weight: bold; font-size: 14.5px; line-height: 1.35; margin-top: 4px; }
  .box { border: 1px solid #000; padding: 5px 8px; margin-top: 10px; font-size: 13px; line-height: 1.55; }
  .box .row { display: flex; justify-content: space-between; gap: 12px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .grade { margin-top: 12px; }
  .grade th, .grade td { border: 1px solid #000; padding: 1.5px 4px; font-size: 12px; }
  .grade .titulo { text-align: center; font-family: Arial, sans-serif; font-size: 13.5px; font-weight: normal; padding: 2px; }
  .grade .head { text-align: center; font-weight: normal; font-size: 13px; }
  .grade .area-row td { padding: 2px 4px; text-align: left; font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; background: #f2f2f2; }
  .grade .comp { font-size: 12px; }
  .grade .nota { text-align: center; font-size: 12px; }
  .grade .tot { font-size: 12.5px; }
  .turmas { margin-top: 12px; }
  .turmas th, .turmas td { border: 1px solid #000; padding: 2px 4px; font-size: 11.5px; }
  .turmas th { font-weight: normal; text-align: center; }
  .turmas .c { text-align: center; }
  .assinaturas { margin-top: 34px; display: flex; justify-content: center; }
  .assin-box { display: flex; border: 1px solid #000; position: relative; }
  .assin-box .lado { width: 285px; padding: 4px 8px; font-family: Arial, sans-serif; font-size: 11.5px; line-height: 1.65; }
  .assin-box .lado + .lado { border-left: 1px solid #000; }
  .carimbo { position: absolute; inset: 0; pointer-events: none; }
  .carimbo img { width: 100%; height: 100%; object-fit: contain; }
</style>
</head>
<body>
<div class="page">
  ${brasao ? `<div class="brasao"><img src="${escapeHtml(brasao)}" /></div>` : ""}
  <div class="gov">
    <div>GOVERNO DO ESTADO DE ${t((d.estado_nome || "").toUpperCase())}</div>
    <div>SECRETARIA DE ESTADO DA EDUCAÇÃO</div>
  </div>

  <div class="box">
    <div>Unidade de Ensino: ${t(d.escola)}</div>
    <div>Endereço: ${t(d.endereco)}</div>
    <div class="row"><span>Ato de Criação: ${t(d.ato_criacao)}</span><span>Publicação: ${t(d.publicacao_criacao)}</span></div>
    <div class="row"><span>Ato de Aprovação: ${t(d.ato_aprovacao)}</span><span>Publicação: ${t(d.publicacao_aprovacao)}</span></div>
  </div>

  <div class="box">
    <div>Nome do Aluno (a): <b>${t(d.nome_aluno)}</b></div>
    <div class="row"><span>Local de Nascimento: ${t(d.local_nascimento)}</span><span>Data: ${t(d.data_nascimento)}</span></div>
    <div>Filiação:&nbsp;&nbsp;&nbsp;Pai: ${t(d.pai)}</div>
    <div style="padding-left:66px">Mãe: ${t(d.mae)}</div>
    <div>Concluiu no ano de ${t(d.periodo_conclusao)} - série do ${t(d.nivel_ensino)}, nos termos da Lei nº. 9394/1996,
      Nº. 3/1998 e Resolução CEE/ES Nº. 137/1999. Resolução CNE/CEB</div>
  </div>

  <table class="grade">
    <colgroup><col><col style="width:90px"><col style="width:90px"><col style="width:90px"></colgroup>
    <tr><th class="titulo" colspan="4">HISTÓRICO ESCOLAR</th></tr>
    <tr><th class="titulo" colspan="4">${t(d.nivel_ensino_grade || "ENSINO MÉDIO")}</th></tr>
    <tr>
      <th class="head">Componentes Curriculares</th>
      <th class="head">1ª<br/>Pontos</th>
      <th class="head">2ª<br/>Pontos</th>
      <th class="head">3ª<br/>Pontos</th>
    </tr>
    ${linhasNotas}
    ${rodapeTotais}
  </table>

  <table class="turmas">
    <colgroup><col style="width:60px"><col style="width:100px"><col style="width:95px"><col><col style="width:170px"></colgroup>
    <tr><th>Ano</th><th>Série/Turma</th><th>Turno</th><th>Unidade de Ensino</th><th>Município/Estado</th></tr>
    ${linhasTurmas}
  </table>

  <div class="assinaturas">
    <div class="assin-box">
      <div class="lado">
        <div>Nome:&nbsp;&nbsp;${t(d.secretario_nome)}</div>
        <div>RG:&nbsp;&nbsp;${t(d.secretario_rg)}</div>
        <div>${t(d.secretario_cargo || "Gerente de Organização Escolar")}</div>
      </div>
      <div class="lado">
        <div>Nome:&nbsp;&nbsp;${t(d.diretor_nome)}</div>
        <div>RG:&nbsp;&nbsp;${t(d.diretor_rg)}</div>
        <div>${t(d.diretor_cargo || "Diretor de Escola")}</div>
      </div>
      <div class="carimbo">${assinatura ? `<img src="${escapeHtml(assinatura)}" />` : ""}</div>
    </div>
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
      "estado", "estado_nome", "escola", "endereco",
      "ato_criacao", "publicacao_criacao", "ato_aprovacao", "publicacao_aprovacao",
      "nome_aluno", "local_nascimento", "data_nascimento", "pai", "mae",
      "periodo_conclusao", "nivel_ensino", "nivel_ensino_grade",
      "ch1", "ch2", "ch3", "dias1", "dias2", "dias3",
      "faltas1", "faltas2", "faltas3", "resultado1", "resultado2", "resultado3",
      "secretario_nome", "secretario_rg", "secretario_cargo",
      "diretor_nome", "diretor_rg", "diretor_cargo",
      "notas_json", "turmas_json",
      "template_brasao_base64", "assinatura_base64",
    ];

    const data: Record<string, string> = {};
    for (const k of keys) data[k] = typeof body[k] === "string" ? body[k] : "";

    const html = buildHistoricoMedioSpHtml(data);

    return new Response(
      JSON.stringify({ success: true, render: "browser", html }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error generating Histórico Escolar (Ensino Médio):", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
